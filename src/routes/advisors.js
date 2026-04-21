const express = require("express");
const { db } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /advisors
router.get("/", authMiddleware, (req, res) => {
  const { search } = req.query;

  let query = `
    SELECT ip.*, u.full_name as name, u.email, u.is_active
    FROM instructor_profiles ip
    JOIN users u ON ip.user_id = u.user_id
    WHERE u.is_active = 1
  `;
  const params = [];

  if (search) {
    query += " AND (u.full_name LIKE ? OR ip.department LIKE ? OR ip.areas_of_expertise LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const advisors = db.prepare(query).all(...params);

  res.json(advisors.map(a => ({
    id: a.instructor_profile_id,
    name: a.name,
    email: a.email,
    department: a.department,
    expertise: a.areas_of_expertise,
    title: a.academic_title,
    available: a.is_available === 1,
  })));
});

// GET /advisors/accounts — admin için hesap listesi
router.get("/accounts", authMiddleware, requireRole("admin"), (req, res) => {
  const advisors = db.prepare(`
    SELECT ip.instructor_profile_id, u.full_name as name, u.email, ip.department, u.is_active
    FROM instructor_profiles ip
    JOIN users u ON ip.user_id = u.user_id
  `).all();

  res.json(advisors.map(a => ({
    id: a.instructor_profile_id,
    name: a.name,
    department: a.department,
    status: a.is_active ? "Active" : "Inactive",
  })));
});

// POST /advisors/:id/request — danışmana istek gönder
router.post("/:id/request", authMiddleware, requireRole("student"), (req, res) => {
  const { projectId, message } = req.body;

  const sp = db.prepare("SELECT student_profile_id FROM student_profiles WHERE user_id = ?").get(req.user.id);
  if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

  const existing = db.prepare(
    "SELECT advisor_request_id FROM advisor_requests WHERE student_profile_id = ? AND instructor_profile_id = ? AND project_id = ?"
  ).get(sp.student_profile_id, req.params.id, projectId);

  if (existing) return res.status(409).json({ error: "Bu danışmana zaten istek gönderildi" });

  db.prepare(`
    INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, message)
    VALUES (?, ?, ?, ?)
  `).run(sp.student_profile_id, req.params.id, projectId, message || null);

  res.status(201).json({ success: true, message: "Danışman isteği gönderildi" });
});

// PATCH /advisors/:id/toggle-status — admin aktif/pasif yap
router.patch("/:id/toggle-status", authMiddleware, requireRole("admin"), (req, res) => {
  const ip = db.prepare("SELECT * FROM instructor_profiles WHERE instructor_profile_id = ?").get(req.params.id);
  if (!ip) return res.status(404).json({ error: "Danışman bulunamadı" });

  const user = db.prepare("SELECT is_active FROM users WHERE user_id = ?").get(ip.user_id);
  db.prepare("UPDATE users SET is_active = ? WHERE user_id = ?").run(user.is_active ? 0 : 1, ip.user_id);

  res.json({ success: true, is_active: !user.is_active });
});

// PATCH /advisors/:id/toggle-availability — admin müsaitlik toggle
router.patch("/:id/toggle-availability", authMiddleware, requireRole("admin"), (req, res) => {
  const ip = db.prepare("SELECT * FROM instructor_profiles WHERE instructor_profile_id = ?").get(req.params.id);
  if (!ip) return res.status(404).json({ error: "Danışman bulunamadı" });

  db.prepare("UPDATE instructor_profiles SET is_available = ? WHERE instructor_profile_id = ?")
    .run(ip.is_available ? 0 : 1, req.params.id);

  res.json({ success: true, is_available: !ip.is_available });
});

module.exports = router;
