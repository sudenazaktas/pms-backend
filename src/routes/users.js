const express = require("express");
const bcrypt = require("bcryptjs");
const { run, get, all } = require("../data/db");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /users/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await get(`
      SELECT u.user_id as id, u.full_name as name, u.email, r.role_name as role
      FROM users u JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?
    `, [req.user.id]);

    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    if (user.role === "student") {
      const profile = await get("SELECT * FROM student_profiles WHERE user_id = ?", [req.user.id]) || {};
      user.department = profile.department;
      user.year = profile.year_level;
      user.github_link = profile.github_link;
      user.linkedin_link = profile.linkedin_link;
      user.bio = profile.bio;

      const skills = await all(`
        SELECT s.skill_name FROM student_skills ss
        JOIN skills s ON ss.skill_id = s.skill_id
        WHERE ss.student_profile_id = ?
      `, [profile.student_profile_id]);
      user.skills = skills.map(s => s.skill_name);

      const interests = await all(`
        SELECT i.interest_name FROM student_interests si
        JOIN interests i ON si.interest_id = i.interest_id
        WHERE si.student_profile_id = ?
      `, [profile.student_profile_id]);
      user.interests = interests.map(i => i.interest_name);

    } else if (user.role === "advisor") {
      const profile = await get("SELECT * FROM instructor_profiles WHERE user_id = ?", [req.user.id]) || {};
      user.department = profile.department;
      user.title = profile.academic_title;
      user.expertise = profile.areas_of_expertise;
      user.research_interests = profile.research_interests;
      user.is_available = profile.is_available;

      const supervisedTypes = await all(`
        SELECT pt.type_name FROM instructor_supervised_project_types ispt
        JOIN project_types pt ON ispt.project_type_id = pt.project_type_id
        WHERE ispt.instructor_profile_id = ?
      `, [profile.instructor_profile_id]);
      user.supervised_project_types = supervisedTypes.map(t => t.type_name);
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/students
router.get("/students", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const students = await all(`
      SELECT u.user_id as id, u.full_name as name, u.email,
             sp.student_profile_id, sp.department, sp.year_level as year,
             sp.bio, sp.github_link, sp.linkedin_link
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
      WHERE r.role_name = 'student'
    `);

    const result = await Promise.all(students.map(async (student) => {
      const skills = await all(`
        SELECT s.skill_name FROM student_skills ss
        JOIN skills s ON ss.skill_id = s.skill_id
        WHERE ss.student_profile_id = ?
      `, [student.student_profile_id]);

      const interests = await all(`
        SELECT i.interest_name FROM student_interests si
        JOIN interests i ON si.interest_id = i.interest_id
        WHERE si.student_profile_id = ?
      `, [student.student_profile_id]);

      return {
        ...student,
        skills: skills.map(s => s.skill_name),
        interests: interests.map(i => i.interest_name),
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/students/:id
router.get("/students/:id", authMiddleware, async (req, res) => {
  try {
    const student = await get(`
      SELECT u.user_id as id, u.full_name as name, u.email,
             sp.student_profile_id, sp.department, sp.year_level as year,
             sp.bio, sp.github_link, sp.linkedin_link
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
      WHERE r.role_name = 'student' AND u.user_id = ?
    `, [req.params.id]);

    if (!student) return res.status(404).json({ error: "Öğrenci bulunamadı" });

    const skills = await all(`
      SELECT s.skill_name FROM student_skills ss
      JOIN skills s ON ss.skill_id = s.skill_id
      WHERE ss.student_profile_id = ?
    `, [student.student_profile_id]);

    const interests = await all(`
      SELECT i.interest_name FROM student_interests si
      JOIN interests i ON si.interest_id = i.interest_id
      WHERE si.student_profile_id = ?
    `, [student.student_profile_id]);

    res.json({
      ...student,
      skills: skills.map(s => s.skill_name),
      interests: interests.map(i => i.interest_name),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/advisors/:id
router.get("/advisors/:id", authMiddleware, async (req, res) => {
  try {
    const advisor = await get(`
      SELECT u.user_id as id, u.full_name as name, u.email,
             ip.instructor_profile_id, ip.department, ip.academic_title as title,
             ip.areas_of_expertise as expertise, ip.research_interests, ip.is_available
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN instructor_profiles ip ON u.user_id = ip.user_id
      WHERE r.role_name = 'advisor' AND u.user_id = ?
    `, [req.params.id]);

    if (!advisor) return res.status(404).json({ error: "Danışman bulunamadı" });

    const supervisedTypes = await all(`
      SELECT pt.type_name FROM instructor_supervised_project_types ispt
      JOIN project_types pt ON ispt.project_type_id = pt.project_type_id
      WHERE ispt.instructor_profile_id = ?
    `, [advisor.instructor_profile_id]);

    res.json({
      ...advisor,
      supervised_project_types: supervisedTypes.map(t => t.type_name),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/me
router.patch("/me", authMiddleware, async (req, res) => {
  try {
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    if (req.user.role === "student") {
      const { department, year_level, bio, github_link, linkedin_link, skills, interests } = req.body;

      await run(`
        UPDATE student_profiles
        SET department = COALESCE(?, department),
            year_level = COALESCE(?, year_level),
            bio = COALESCE(?, bio),
            github_link = COALESCE(?, github_link),
            linkedin_link = COALESCE(?, linkedin_link)
        WHERE user_id = ?
      `, [department, year_level, bio, github_link, linkedin_link, req.user.id]);

      const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.user.id]);

      if (skills && Array.isArray(skills)) {
        await run("DELETE FROM student_skills WHERE student_profile_id = ?", [sp.student_profile_id]);
        for (const skillName of skills) {
          await run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [skillName]);
          const skill = await get("SELECT skill_id FROM skills WHERE skill_name = ?", [skillName]);
          await run("INSERT OR IGNORE INTO student_skills (student_profile_id, skill_id) VALUES (?, ?)", [sp.student_profile_id, skill.skill_id]);
        }
      }

      if (interests && Array.isArray(interests)) {
        await run("DELETE FROM student_interests WHERE student_profile_id = ?", [sp.student_profile_id]);
        for (const interestName of interests) {
          await run("INSERT OR IGNORE INTO interests (interest_name) VALUES (?)", [interestName]);
          const interest = await get("SELECT interest_id FROM interests WHERE interest_name = ?", [interestName]);
          await run("INSERT OR IGNORE INTO student_interests (student_profile_id, interest_id) VALUES (?, ?)", [sp.student_profile_id, interest.interest_id]);
        }
      }

    } else if (req.user.role === "advisor") {
      const { department, academic_title, areas_of_expertise, research_interests, is_available, supervised_project_types } = req.body;

      await run(`
        UPDATE instructor_profiles
        SET department = COALESCE(?, department),
            academic_title = COALESCE(?, academic_title),
            areas_of_expertise = COALESCE(?, areas_of_expertise),
            research_interests = COALESCE(?, research_interests),
            is_available = COALESCE(?, is_available)
        WHERE user_id = ?
      `, [department, academic_title, areas_of_expertise, research_interests, is_available, req.user.id]);

      if (supervised_project_types && Array.isArray(supervised_project_types)) {
        const ip = await get("SELECT instructor_profile_id FROM instructor_profiles WHERE user_id = ?", [req.user.id]);
        await run("DELETE FROM instructor_supervised_project_types WHERE instructor_profile_id = ?", [ip.instructor_profile_id]);
        for (const typeName of supervised_project_types) {
          await run("INSERT OR IGNORE INTO project_types (type_name) VALUES (?)", [typeName]);
          const ptype = await get("SELECT project_type_id FROM project_types WHERE type_name = ?", [typeName]);
          await run("INSERT OR IGNORE INTO instructor_supervised_project_types (instructor_profile_id, project_type_id) VALUES (?, ?)", [ip.instructor_profile_id, ptype.project_type_id]);
        }
      }
    }

    res.json({ success: true, message: "Profil güncellendi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/students — admin yeni öğrenci ekle
router.post("/students", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, department, year_level, bio, github_link, linkedin_link, skills, interests } = req.body;
    if (!name || !email) return res.status(400).json({ error: "İsim ve email zorunlu" });

    const studentRole = await get("SELECT role_id FROM roles WHERE role_name = 'student'");
    const hash = require("bcryptjs").hashSync("123456", 10);

    const result = await run(
      "INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)",
      [studentRole.role_id, email.toLowerCase(), name, hash]
    );

    const sp = await run(
      "INSERT INTO student_profiles (user_id, department, year_level, bio, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?, ?)",
      [result.lastID, department || null, year_level || null, bio || null, github_link || null, linkedin_link || null]
    );

    if (skills && Array.isArray(skills)) {
      for (const skillName of skills) {
        await run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [skillName]);
        const skill = await get("SELECT skill_id FROM skills WHERE skill_name = ?", [skillName]);
        await run("INSERT OR IGNORE INTO student_skills (student_profile_id, skill_id) VALUES (?, ?)", [sp.lastID, skill.skill_id]);
      }
    }

    if (interests && Array.isArray(interests)) {
      for (const interestName of interests) {
        await run("INSERT OR IGNORE INTO interests (interest_name) VALUES (?)", [interestName]);
        const interest = await get("SELECT interest_id FROM interests WHERE interest_name = ?", [interestName]);
        await run("INSERT OR IGNORE INTO student_interests (student_profile_id, interest_id) VALUES (?, ?)", [sp.lastID, interest.interest_id]);
      }
    }

    res.status(201).json({ success: true, message: "Öğrenci eklendi", id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/students/:id — admin öğrenci düzenle
router.patch("/students/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, department, year_level, bio, github_link, linkedin_link, skills, interests } = req.body;

    if (name) await run("UPDATE users SET full_name = ? WHERE user_id = ?", [name, req.params.id]);

    const sp = await get("SELECT student_profile_id FROM student_profiles WHERE user_id = ?", [req.params.id]);
    if (!sp) return res.status(404).json({ error: "Öğrenci profili bulunamadı" });

    await run(`
      UPDATE student_profiles
      SET department = COALESCE(?, department),
          year_level = COALESCE(?, year_level),
          bio = COALESCE(?, bio),
          github_link = COALESCE(?, github_link),
          linkedin_link = COALESCE(?, linkedin_link)
      WHERE user_id = ?
    `, [department, year_level, bio, github_link, linkedin_link, req.params.id]);

    if (skills && Array.isArray(skills)) {
      await run("DELETE FROM student_skills WHERE student_profile_id = ?", [sp.student_profile_id]);
      for (const skillName of skills) {
        await run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [skillName]);
        const skill = await get("SELECT skill_id FROM skills WHERE skill_name = ?", [skillName]);
        await run("INSERT OR IGNORE INTO student_skills (student_profile_id, skill_id) VALUES (?, ?)", [sp.student_profile_id, skill.skill_id]);
      }
    }

    if (interests && Array.isArray(interests)) {
      await run("DELETE FROM student_interests WHERE student_profile_id = ?", [sp.student_profile_id]);
      for (const interestName of interests) {
        await run("INSERT OR IGNORE INTO interests (interest_name) VALUES (?)", [interestName]);
        const interest = await get("SELECT interest_id FROM interests WHERE interest_name = ?", [interestName]);
        await run("INSERT OR IGNORE INTO student_interests (student_profile_id, interest_id) VALUES (?, ?)", [sp.student_profile_id, interest.interest_id]);
      }
    }

    res.json({ success: true, message: "Öğrenci güncellendi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/advisors — admin yeni danışman ekle
router.post("/advisors", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, department, academic_title, areas_of_expertise, research_interests, is_available, supervised_project_types } = req.body;
    if (!name || !email) return res.status(400).json({ error: "İsim ve email zorunlu" });

    const advisorRole = await get("SELECT role_id FROM roles WHERE role_name = 'advisor'");
    const hash = require("bcryptjs").hashSync("123456", 10);

    const result = await run(
      "INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)",
      [advisorRole.role_id, email.toLowerCase(), name, hash]
    );

    const ip = await run(
      "INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)",
      [result.lastID, department || null, academic_title || null, areas_of_expertise || null, research_interests || null, is_available ?? 1]
    );

    if (supervised_project_types && Array.isArray(supervised_project_types)) {
      for (const typeName of supervised_project_types) {
        await run("INSERT OR IGNORE INTO project_types (type_name) VALUES (?)", [typeName]);
        const ptype = await get("SELECT project_type_id FROM project_types WHERE type_name = ?", [typeName]);
        await run("INSERT OR IGNORE INTO instructor_supervised_project_types (instructor_profile_id, project_type_id) VALUES (?, ?)", [ip.lastID, ptype.project_type_id]);
      }
    }

    res.status(201).json({ success: true, message: "Danışman eklendi", id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/advisors/:id — admin danışman düzenle
router.patch("/advisors/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, department, academic_title, areas_of_expertise, research_interests, is_available, supervised_project_types } = req.body;

    if (name) await run("UPDATE users SET full_name = ? WHERE user_id = ?", [name, req.params.id]);

    const ip = await get("SELECT instructor_profile_id FROM instructor_profiles WHERE user_id = ?", [req.params.id]);
    if (!ip) return res.status(404).json({ error: "Danışman profili bulunamadı" });

    await run(`
      UPDATE instructor_profiles
      SET department = COALESCE(?, department),
          academic_title = COALESCE(?, academic_title),
          areas_of_expertise = COALESCE(?, areas_of_expertise),
          research_interests = COALESCE(?, research_interests),
          is_available = COALESCE(?, is_available)
      WHERE user_id = ?
    `, [department, academic_title, areas_of_expertise, research_interests, is_available, req.params.id]);

    if (supervised_project_types && Array.isArray(supervised_project_types)) {
      await run("DELETE FROM instructor_supervised_project_types WHERE instructor_profile_id = ?", [ip.instructor_profile_id]);
      for (const typeName of supervised_project_types) {
        await run("INSERT OR IGNORE INTO project_types (type_name) VALUES (?)", [typeName]);
        const ptype = await get("SELECT project_type_id FROM project_types WHERE type_name = ?", [typeName]);
        await run("INSERT OR IGNORE INTO instructor_supervised_project_types (instructor_profile_id, project_type_id) VALUES (?, ?)", [ip.instructor_profile_id, ptype.project_type_id]);
      }
    }

    res.json({ success: true, message: "Danışman güncellendi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/:id/toggle-status
router.patch("/:id/toggle-status", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    await run("UPDATE users SET is_active = ? WHERE user_id = ?", [user.is_active ? 0 : 1, req.params.id]);

    res.json({ success: true, is_active: !user.is_active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;