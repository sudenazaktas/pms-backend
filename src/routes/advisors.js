const express = require("express");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /advisors
router.get("/", authMiddleware, async (req, res) => {
  try {
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

    const advisors = await all(query, params);

    res.json(advisors.map(a => ({
      id: a.instructor_profile_id,
      name: a.name,
      email: a.email,
      department: a.department,
      expertise: a.areas_of_expertise,
      title: a.academic_title,
      available: a.is_available === 1,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /advisors/accounts
router.get("/accounts", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const advisors = await all(`
      SELECT ip.instructor_profile_id, u.full_name as name, u.email, ip.department, u.is_active
      FROM instructor_profiles ip
      JOIN users u ON ip.user_id = u.user_id
    `);

    res.json(advisors.map(a => ({
      id: a.instructor_profile_id,
      name: a.name,
      department: a.department,
      status: a.is_active ? "Active" : "Inactive",
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /advisors/:id/request
router.post("/:id/request", authMiddleware, requireRole("student"), async (req, res) => {
  try {
    const { projectId, message } = req.body;

    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);
    if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

    const existing = await get(
      "SELECT advisor_request_id FROM advisor_requests WHERE student_profile_id = ? AND instructor_profile_id = ? AND project_id = ?",
      [sp.student_profile_id, req.params.id, projectId]
    );
    if (existing) return res.status(409).json({ error: "Bu danışmana zaten istek gönderildi" });

    await run(`
      INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, message)
      VALUES (?, ?, ?, ?)
    `, [sp.student_profile_id, req.params.id, projectId, message || null]);

    res.status(201).json({ success: true, message: "Danışman isteği gönderildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /advisors/:id/toggle-status
router.patch("/:id/toggle-status", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const ip = await get("SELECT * FROM instructor_profiles WHERE instructor_profile_id = ?", [req.params.id]);
    if (!ip) return res.status(404).json({ error: "Danışman bulunamadı" });

    const user = await get("SELECT is_active FROM users WHERE user_id = ?", [ip.user_id]);
    await run("UPDATE users SET is_active = ? WHERE user_id = ?", [user.is_active ? 0 : 1, ip.user_id]);

    res.json({ success: true, is_active: !user.is_active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /advisors/:id/toggle-availability
router.patch("/:id/toggle-availability", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const ip = await get("SELECT * FROM instructor_profiles WHERE instructor_profile_id = ?", [req.params.id]);
    if (!ip) return res.status(404).json({ error: "Danışman bulunamadı" });

    await run("UPDATE instructor_profiles SET is_available = ? WHERE instructor_profile_id = ?",
      [ip.is_available ? 0 : 1, req.params.id]);

    res.json({ success: true, is_available: !ip.is_available });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;