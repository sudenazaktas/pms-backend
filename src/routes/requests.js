const express = require("express");
const { db } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /requests — danışmana gelen istekler
router.get("/", authMiddleware, requireRole("advisor"), (req, res) => {
  const ip = db.prepare("SELECT instructor_profile_id FROM instructor_profiles WHERE user_id = ?").get(req.user.id);
  if (!ip) return res.status(400).json({ error: "Danışman profili bulunamadı" });

  const requests = db.prepare(`
    SELECT
      ar.advisor_request_id as id,
      ar.status,
      ar.message,
      ar.created_at,
      u.full_name   as student,
      p.title       as project,
      pc.category_name as type
    FROM advisor_requests ar
    JOIN student_profiles sp ON ar.student_profile_id = sp.student_profile_id
    JOIN users u             ON sp.user_id = u.user_id
    JOIN projects p          ON ar.project_id = p.project_id
    JOIN project_categories pc ON p.category_id = pc.category_id
    WHERE ar.instructor_profile_id = ?
    ORDER BY ar.created_at DESC
  `).all(ip.instructor_profile_id);

  res.json(requests);
});

// PATCH /requests/:id — kabul / ret et
router.patch("/:id", authMiddleware, requireRole("advisor"), (req, res) => {
  const { status } = req.body;

  if (!["Accepted", "Rejected"].includes(status))
    return res.status(400).json({ error: "Status 'Accepted' veya 'Rejected' olmalı" });

  const ip = db.prepare("SELECT instructor_profile_id FROM instructor_profiles WHERE user_id = ?").get(req.user.id);
  if (!ip) return res.status(400).json({ error: "Danışman profili bulunamadı" });

  const ar = db.prepare("SELECT * FROM advisor_requests WHERE advisor_request_id = ?").get(req.params.id);
  if (!ar) return res.status(404).json({ error: "İstek bulunamadı" });

  if (ar.instructor_profile_id !== ip.instructor_profile_id)
    return res.status(403).json({ error: "Bu isteği güncelleme yetkiniz yok" });

  db.prepare(`
    UPDATE advisor_requests SET status = ?, reviewed_at = datetime('now') WHERE advisor_request_id = ?
  `).run(status, req.params.id);

  if (status === "Accepted") {
    db.prepare(`
      UPDATE projects SET assigned_instructor_profile_id = ?, advisor_assigned = 1, status = 'Advisor Assigned'
      WHERE project_id = ?
    `).run(ip.instructor_profile_id, ar.project_id);
  }

  res.json({ success: true, status });
});

module.exports = router;
