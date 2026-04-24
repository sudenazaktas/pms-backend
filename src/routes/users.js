const express = require("express");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /users/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await get(`
      SELECT u.user_id as id, u.full_name as name, u.email, r.role_name as role
      FROM users u JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?
    `, [req.user.id]);

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    if (user.role === "student") {
      const profile = await get("SELECT * FROM student_profiles WHERE user_id = ?", [req.user.id]) || {};
      user.department = profile.department;
      user.year = profile.year_level;
      user.github_link = profile.github_link;
      user.linkedin_link = profile.linkedin_link;
      user.bio = profile.bio;
    } else if (user.role === "advisor") {
      const profile = await get("SELECT * FROM instructor_profiles WHERE user_id = ?", [req.user.id]) || {};
      user.department = profile.department;
      user.title = profile.academic_title;
      user.expertise = profile.areas_of_expertise;
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/students
router.get("/students", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const students = await all(`
      SELECT u.user_id as id, u.full_name as name, u.email,
             sp.department, sp.year_level as year
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
      WHERE r.role_name = 'student'
    `);

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/me
router.patch("/me", authMiddleware, async (req, res) => {
  try {
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    if (req.user.role === "student") {
      const { department, year_level, bio, github_link, linkedin_link } = req.body;
      await run(`
        UPDATE student_profiles
        SET department = COALESCE(?, department),
            year_level = COALESCE(?, year_level),
            bio = COALESCE(?, bio),
            github_link = COALESCE(?, github_link),
            linkedin_link = COALESCE(?, linkedin_link)
        WHERE user_id = ?
      `, [department, year_level, bio, github_link, linkedin_link, req.user.id]);
    } else if (req.user.role === "advisor") {
      const { department, academic_title, areas_of_expertise, research_interests, is_available } = req.body;
      await run(`
        UPDATE instructor_profiles
        SET department = COALESCE(?, department),
            academic_title = COALESCE(?, academic_title),
            areas_of_expertise = COALESCE(?, areas_of_expertise),
            research_interests = COALESCE(?, research_interests),
            is_available = COALESCE(?, is_available)
        WHERE user_id = ?
      `, [department, academic_title, areas_of_expertise, research_interests, is_available, req.user.id]);
    }

    res.json({ success: true, message: "Profil güncellendi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/:id/toggle-status
router.patch("/:id/toggle-status", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    await run("UPDATE users SET is_active = ? WHERE user_id = ?", [user.is_active ? 0 : 1, req.params.id]);

    res.json({ success: true, is_active: !user.is_active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;