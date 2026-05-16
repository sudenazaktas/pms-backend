const express = require("express");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /categories
router.get("/", authMiddleware, async (req, res) => {
  try {
    const categories = await all("SELECT * FROM project_categories ORDER BY category_id ASC");
    res.json(categories.map(c => ({
      id: c.category_id,
      name: c.category_name,
      description: c.description,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /categories — admin kategori ekle
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Kategori adı zorunlu" });

    const existing = await get("SELECT category_id FROM project_categories WHERE category_name = ?", [name]);
    if (existing) return res.status(409).json({ error: "Bu kategori zaten var" });

    const result = await run(
      "INSERT INTO project_categories (category_name, description) VALUES (?, ?)",
      [name, description || null]
    );

    res.status(201).json({ success: true, id: result.lastID, name, description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /categories/:id — admin kategori düzenle
router.patch("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const cat = await get("SELECT * FROM project_categories WHERE category_id = ?", [req.params.id]);
    if (!cat) return res.status(404).json({ error: "Kategori bulunamadı" });

    await run(
      "UPDATE project_categories SET category_name = COALESCE(?, category_name), description = COALESCE(?, description) WHERE category_id = ?",
      [name, description, req.params.id]
    );

    res.json({ success: true, message: "Kategori güncellendi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /categories/:id — admin kategori sil
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const cat = await get("SELECT * FROM project_categories WHERE category_id = ?", [req.params.id]);
    if (!cat) return res.status(404).json({ error: "Kategori bulunamadı" });

    await run("DELETE FROM project_categories WHERE category_id = ?", [req.params.id]);
    res.json({ success: true, message: "Kategori silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;