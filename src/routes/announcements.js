const express = require("express");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

const TONE = { TUBITAK: "blue", Teknofest: "red", "Course Project": "amber" };

// GET /announcements
router.get("/", authMiddleware, async (req, res) => {
  try {
    const announcements = await all(`
      SELECT a.*, pc.category_name
      FROM announcements a
      LEFT JOIN project_categories pc ON a.category_id = pc.category_id
      ORDER BY a.created_at DESC
    `);

    res.json(announcements.map(a => ({
      id: a.announcement_id,
      title: a.title,
      body: a.description,
      tag: a.category_name,
      tone: TONE[a.category_name] || "blue",
      created_at: a.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /announcements
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { title, body, category } = req.body;
    if (!title || !category) return res.status(400).json({ error: "Başlık ve kategori zorunlu" });

    const cat = await get("SELECT category_id FROM project_categories WHERE category_name = ?", [category]);
    if (!cat) return res.status(400).json({ error: "Geçersiz kategori" });

    const result = await run(`
      INSERT INTO announcements (category_id, created_by_user_id, title, description)
      VALUES (?, ?, ?, ?)
    `, [cat.category_id, req.user.id, title, body || ""]);

    const ann = await get(`
      SELECT a.*, pc.category_name FROM announcements a
      JOIN project_categories pc ON a.category_id = pc.category_id
      WHERE a.announcement_id = ?
    `, [result.lastID]);

    res.status(201).json({
      id: ann.announcement_id,
      title: ann.title,
      body: ann.description,
      tag: ann.category_name,
      tone: TONE[ann.category_name] || "blue",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /announcements/:id
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    await run("DELETE FROM announcements WHERE announcement_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;