const express = require("express");
const { db } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /users/me
router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT u.user_id as id, u.full_name as name, u.email, r.role_name as role
    FROM users u JOIN roles r ON u.role_id = r.role_id
    WHERE u.user_id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  let profile = {};
  if (user.role === "student") {
    profile = db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(req.user.id) || {};
    user.department = profile.department;
    user.year = profile.year_level;
    user.github_link = profile.github_link;
    user.linkedin_link = profile.linkedin_link;
    user.bio = profile.bio;
  } else if (user.role === "advisor") {
    profile = db.prepare("SELECT * FROM instructor_profiles WHERE user_id = ?").get(req.user.id) || {};
    user.department = profile.department;
    user.title = profile.academic_title;
    user.expertise = profile.areas_of_expertise;
  }

  res.json(user);
});

// GET /users/students — admin
router.get("/students", authMiddleware, requireRole("admin"), (req, res) => {
  const students = db.prepare(`
    SELECT u.user_id as id, u.full_name as name, u.email,
           sp.department, sp.year_level as year
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
    WHERE r.role_name = 'student'
  `).all();

  res.json(students);
});
// PATCH /users/me — profil güncelle
router.patch("/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  if (req.user.role === "student") {
    const { department, year_level, bio, github_link, linkedin_link } = req.body;
    db.prepare(`
      UPDATE student_profiles
      SET department = COALESCE(?, department),
          year_level = COALESCE(?, year_level),
          bio = COALESCE(?, bio),
          github_link = COALESCE(?, github_link),
          linkedin_link = COALESCE(?, linkedin_link)
      WHERE user_id = ?
    `).run(department, year_level, bio, github_link, linkedin_link, req.user.id);

  } else if (req.user.role === "advisor") {
    const { department, academic_title, areas_of_expertise, research_interests, is_available } = req.body;
    db.prepare(`
      UPDATE instructor_profiles
      SET department = COALESCE(?, department),
          academic_title = COALESCE(?, academic_title),
          areas_of_expertise = COALESCE(?, areas_of_expertise),
          research_interests = COALESCE(?, research_interests),
          is_available = COALESCE(?, is_available)
      WHERE user_id = ?
    `).run(department, academic_title, areas_of_expertise, research_interests, is_available, req.user.id);
  }

  res.json({ success: true, message: "Profil güncellendi" });
});
// PATCH /users/:id/toggle-status — admin kullanıcıyı aktif/pasif yap
router.patch("/:id/toggle-status", authMiddleware, requireRole("admin"), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  db.prepare("UPDATE users SET is_active = ? WHERE user_id = ?")
    .run(user.is_active ? 0 : 1, req.params.id);

  res.json({ success: true, is_active: !user.is_active });
});
module.exports = router;
