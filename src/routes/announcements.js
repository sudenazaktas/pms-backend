const express = require("express");
const { db } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

const TONE = { TUBITAK: "blue", Teknofest: "red", "Course Project": "amber" };

// GET /announcements
router.get("/", authMiddleware, (req, res) => {
  const announcements = db.prepare(`
    SELECT a.*, pc.category_name
    FROM announcements a
    LEFT JOIN project_categories pc ON a.category_id = pc.category_id
    ORDER BY a.created_at DESC
  `).all();

  res.json(announcements.map(a => ({
    id: a.announcement_id,
    title: a.title,
    body: a.description,
    tag: a.category_name,
    tone: TONE[a.category_name] || "blue",
    created_at: a.created_at,
  })));
});

// POST /announcements — sadece admin
router.post("/", authMiddleware, requireRole("admin"), (req, res) => {
  const { title, body, category } = req.body;
  if (!title || !category) return res.status(400).json({ error: "Başlık ve kategori zorunlu" });

  const cat = db.prepare("SELECT category_id FROM project_categories WHERE category_name = ?").get(category);
  if (!cat) return res.status(400).json({ error: "Geçersiz kategori" });

  const result = db.prepare(`
    INSERT INTO announcements (category_id, created_by_user_id, title, description)
    VALUES (?, ?, ?, ?)
  `).run(cat.category_id, req.user.id, title, body || "");

  const ann = db.prepare(`
    SELECT a.*, pc.category_name FROM announcements a
    JOIN project_categories pc ON a.category_id = pc.category_id
    WHERE a.announcement_id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({
    id: ann.announcement_id,
    title: ann.title,
    body: ann.description,
    tag: ann.category_name,
    tone: TONE[ann.category_name] || "blue",
  });
});

// DELETE /announcements/:id
router.delete("/:id", authMiddleware, requireRole("admin"), (req, res) => {
  db.prepare("DELETE FROM announcements WHERE announcement_id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
