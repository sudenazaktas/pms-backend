const express = require("express");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

async function formatProject(p) {
  const skills = await all(`
    SELECT s.skill_name FROM project_required_skills prs
    JOIN skills s ON prs.skill_id = s.skill_id
    WHERE prs.project_id = ?
  `, [p.project_id]);

  return {
    id: p.project_id,
    title: p.title,
    description: p.description,
    type: p.category_name,
    status: p.status,
    owner: p.owner_name,
    advisor: p.advisor_name || "Not assigned",
    teamMembers: p.team_size,
    requiredSkills: skills.map(s => s.skill_name),
    budget: p.budget,
    created_at: p.created_at,
  };
}

// GET /projects
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT p.*,
        pc.category_name,
        u_owner.full_name as owner_name,
        u_adv.full_name   as advisor_name
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      LEFT JOIN student_profiles sp   ON p.owner_student_profile_id = sp.student_profile_id
      LEFT JOIN users u_owner         ON sp.user_id = u_owner.user_id
      LEFT JOIN instructor_profiles ip ON p.assigned_instructor_profile_id = ip.instructor_profile_id
      LEFT JOIN users u_adv            ON ip.user_id = u_adv.user_id
    `;

    const params = [];
    if (search) {
      query += ` WHERE p.title LIKE ? OR p.status LIKE ? OR u_owner.full_name LIKE ? OR pc.category_name LIKE ?`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += " ORDER BY p.created_at DESC";

    const projects = await all(query, params);
    const result = await Promise.all(projects.map(formatProject));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /projects/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const p = await get(`
      SELECT p.*,
        pc.category_name,
        u_owner.full_name as owner_name,
        u_adv.full_name   as advisor_name
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      LEFT JOIN student_profiles sp   ON p.owner_student_profile_id = sp.student_profile_id
      LEFT JOIN users u_owner         ON sp.user_id = u_owner.user_id
      LEFT JOIN instructor_profiles ip ON p.assigned_instructor_profile_id = ip.instructor_profile_id
      LEFT JOIN users u_adv            ON ip.user_id = u_adv.user_id
      WHERE p.project_id = ?
    `, [req.params.id]);

    if (!p) return res.status(404).json({ error: "Proje bulunamadı" });
    res.json(await formatProject(p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /projects
router.post("/", authMiddleware, requireRole("student"), async (req, res) => {
  try {
    const { title, description, type, teamMembers, skills, budget } = req.body;
    if (!title) return res.status(400).json({ error: "Başlık zorunlu" });

    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);
    if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

    const cat = await get("SELECT category_id FROM project_categories WHERE category_name = ?", [type || "Course Project"]);
    if (!cat) return res.status(400).json({ error: "Geçersiz proje tipi" });

    const result = await run(`
      INSERT INTO projects (owner_student_profile_id, category_id, title, description, team_size, budget)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sp.student_profile_id, cat.category_id, title, description || "", Number(teamMembers) || 4, budget || null]);

    const projectId = result.lastID;

    if (skills) {
      const skillList = skills.split(",").map(s => s.trim()).filter(Boolean);
      for (const skillName of skillList) {
        await run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [skillName]);
        const skill = await get("SELECT skill_id FROM skills WHERE skill_name = ?", [skillName]);
        await run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [projectId, skill.skill_id]);
      }
    }

    const p = await get(`
      SELECT p.*, pc.category_name, u.full_name as owner_name, null as advisor_name
      FROM projects p
      JOIN project_categories pc ON p.category_id = pc.category_id
      JOIN student_profiles sp ON p.owner_student_profile_id = sp.student_profile_id
      JOIN users u ON sp.user_id = u.user_id
      WHERE p.project_id = ?
    `, [projectId]);

    res.status(201).json(await formatProject(p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /projects/:id/apply
router.post("/:id/apply", authMiddleware, requireRole("student"), async (req, res) => {
  try {
    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);
    if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

    const existing = await get(
      "SELECT application_id FROM project_applications WHERE project_id = ? AND student_profile_id = ?",
      [req.params.id, sp.student_profile_id]
    );
    if (existing) return res.status(409).json({ error: "Bu projeye zaten başvurdunuz" });

    await run("INSERT INTO project_applications (project_id, student_profile_id) VALUES (?, ?)", [req.params.id, sp.student_profile_id]);
    res.status(201).json({ success: true, message: "Başvurunuz alındı" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /projects/:id/applications
router.get("/:id/applications", authMiddleware, requireRole("student"), async (req, res) => {
  try {
    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);
    if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

    const project = await get("SELECT * FROM projects WHERE project_id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

    if (project.owner_student_profile_id !== sp.student_profile_id)
      return res.status(403).json({ error: "Bu projenin sahibi değilsiniz" });

    const applications = await all(`
      SELECT
        pa.application_id as id,
        pa.status,
        pa.applied_at,
        pa.reviewed_at,
        u.full_name as student_name,
        u.email as student_email,
        sp2.department,
        sp2.year_level,
        sp2.github_link,
        sp2.linkedin_link
      FROM project_applications pa
      JOIN student_profiles sp2 ON pa.student_profile_id = sp2.student_profile_id
      JOIN users u ON sp2.user_id = u.user_id
      WHERE pa.project_id = ?
      ORDER BY pa.applied_at DESC
    `, [req.params.id]);

    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /projects/:id/applications/:appId
router.patch("/:id/applications/:appId", authMiddleware, requireRole("student"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Accepted", "Rejected"].includes(status))
      return res.status(400).json({ error: "Status 'Accepted' veya 'Rejected' olmalı" });

    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);
    if (!sp) return res.status(400).json({ error: "Öğrenci profili bulunamadı" });

    const project = await get("SELECT * FROM projects WHERE project_id = ?", [req.params.id]);
    if (!project) return res.status(404).json({ error: "Proje bulunamadı" });

    if (project.owner_student_profile_id !== sp.student_profile_id)
      return res.status(403).json({ error: "Bu projenin sahibi değilsiniz" });

    await run(`
      UPDATE project_applications SET status = ?, reviewed_at = datetime('now') WHERE application_id = ?
    `, [status, req.params.appId]);

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;