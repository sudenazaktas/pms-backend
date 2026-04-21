const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../data/db");

const router = express.Router();

// POST /auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email ve şifre zorunlu" });

  const user = db.prepare(`
    SELECT u.*, r.role_name as role
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.email = ? AND u.is_active = 1
  `).get(email.trim().toLowerCase());

  if (!user) return res.status(401).json({ error: "Bu email ile hesap bulunamadı" });

  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Şifre hatalı" });

  // Role göre profil bilgisi çek
  let profile = {};
  if (user.role === "student") {
    profile = db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(user.user_id) || {};
  } else if (user.role === "advisor") {
    profile = db.prepare("SELECT * FROM instructor_profiles WHERE user_id = ?").get(user.user_id) || {};
  }

  const token = jwt.sign(
    { id: user.user_id, role: user.role, name: user.full_name, email: user.email },
    process.env.JWT_SECRET || "pms_secret",
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: {
      id: user.user_id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      department: profile.department || null,
      year: profile.year_level || null,
      title: profile.academic_title || null,
    },
  });
});

module.exports = router;
