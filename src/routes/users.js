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

module.exports = router;
