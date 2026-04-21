const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "../../pms.db"));

// Sync sorgu yardımcıları
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  // Tabloları oluştur
  await run(`CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(role_id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await run(`CREATE TABLE IF NOT EXISTS student_profiles (
    student_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id),
    department TEXT,
    year_level TEXT,
    bio TEXT,
    github_link TEXT,
    linkedin_link TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS instructor_profiles (
    instructor_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id),
    department TEXT,
    academic_title TEXT,
    areas_of_expertise TEXT,
    research_interests TEXT,
    previous_supervised_projects INTEGER DEFAULT 0,
    is_available INTEGER DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS project_categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS skills (
    skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT UNIQUE NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_student_profile_id INTEGER REFERENCES student_profiles(student_profile_id),
    category_id INTEGER REFERENCES project_categories(category_id),
    assigned_instructor_profile_id INTEGER REFERENCES instructor_profiles(instructor_profile_id),
    title TEXT NOT NULL,
    description TEXT,
    team_size INTEGER DEFAULT 4,
    budget REAL,
    advisor_assigned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Open',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await run(`CREATE TABLE IF NOT EXISTS project_roles (
    project_role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    role_name TEXT NOT NULL,
    count_needed INTEGER DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS project_required_skills (
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    skill_id INTEGER NOT NULL REFERENCES skills(skill_id),
    PRIMARY KEY (project_id, skill_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS student_skills (
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    skill_id INTEGER NOT NULL REFERENCES skills(skill_id),
    PRIMARY KEY (student_profile_id, skill_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS advisor_requests (
    advisor_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    instructor_profile_id INTEGER NOT NULL REFERENCES instructor_profiles(instructor_profile_id),
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    status TEXT DEFAULT 'Waiting',
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS project_applications (
    application_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    status TEXT DEFAULT 'Waiting',
    applied_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS announcements (
    announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES project_categories(category_id),
    created_by_user_id INTEGER REFERENCES users(user_id),
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Zaten seed yapıldıysa çık
  const roleCount = await get("SELECT COUNT(*) as count FROM roles");
  if (roleCount.count > 0) return;

  // ROLLER
  await run("INSERT INTO roles (role_name) VALUES (?)", ["student"]);
  await run("INSERT INTO roles (role_name) VALUES (?)", ["advisor"]);
  await run("INSERT INTO roles (role_name) VALUES (?)", ["admin"]);

  const studentRole = await get("SELECT role_id FROM roles WHERE role_name = 'student'");
  const advisorRole = await get("SELECT role_id FROM roles WHERE role_name = 'advisor'");
  const adminRole   = await get("SELECT role_id FROM roles WHERE role_name = 'admin'");

  // KATEGORİLER
  await run("INSERT INTO project_categories (category_name) VALUES (?)", ["Course Project"]);
  await run("INSERT INTO project_categories (category_name) VALUES (?)", ["TUBITAK"]);
  await run("INSERT INTO project_categories (category_name) VALUES (?)", ["Teknofest"]);

  const catCourse    = await get("SELECT category_id FROM project_categories WHERE category_name = 'Course Project'");
  const catTubitak   = await get("SELECT category_id FROM project_categories WHERE category_name = 'TUBITAK'");
  const catTeknofest = await get("SELECT category_id FROM project_categories WHERE category_name = 'Teknofest'");

  // BECERİLER
  for (const s of ["React","Node.js","UI/UX","Flutter","Firebase","UX Research","Python","Machine Learning","Data Analysis","IoT"]) {
    await run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [s]);
  }
  const sk = async (name) => (await get("SELECT skill_id FROM skills WHERE skill_name = ?", [name])).skill_id;

  // KULLANICILAR
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const u1 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "sevinc.yigit@ogr.university.edu.tr",   "Sevinc Yigit",        hash("123456")]);
  const u2 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "firdevs.su@ogr.university.edu.tr",     "Firdevs Su",          hash("123456")]);
  const u3 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "emre.guner@ogr.university.edu.tr",     "Emre Guner",          hash("123456")]);
  const u4 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "umut.kaya@ogr.university.edu.tr",      "Umut Kaya",           hash("123456")]);
  const u5 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "sila.korklubasoglu@university.edu.tr", "Sila Korklubasoglu",  hash("123456")]);
  const u6 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "selin.yuce@university.edu.tr",         "Prof. Selin Yuce",    hash("123456")]);
  const u7 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "mehmet.yildiz@university.edu.tr",      "Prof. Mehmet Yildiz", hash("123456")]);
  const u8 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "duygu.dogan@university.edu.tr",        "Prof. Duygu Dogan",   hash("123456")]);
  const u9 = await run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [adminRole.role_id,   "admin@university.edu.tr",              "System Admin",        hash("123456")]);

  // ÖĞRENCİ PROFİLLERİ
  const sp1 = await run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u1.lastID, "Software Engineering",   "3", "github.com/sevincyigit", "linkedin.com/in/sevincyigit"]);
  const sp2 = await run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u2.lastID, "Software Engineering",   "4", null, null]);
  const sp3 = await run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u3.lastID, "Electrical Engineering", "2", null, null]);
  const sp4 = await run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u4.lastID, "Computer Engineering",   "4", null, null]);

  for (const sid of [await sk("React"), await sk("Python"), await sk("UI/UX")]) {
    await run("INSERT OR IGNORE INTO student_skills (student_profile_id, skill_id) VALUES (?, ?)", [sp1.lastID, sid]);
  }

  // DANIŞMAN PROFİLLERİ
  const ip1 = await run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u5.lastID, "Software Engineering", "Professor", "Machine Learning, Python",  "NLP, Computer Vision",      1]);
  const ip2 = await run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u6.lastID, "Software Engineering", "Professor", "Artificial Intelligence",   "Deep Learning",             1]);
  const ip3 = await run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u7.lastID, "Computer Engineering", "Professor", "Data Mining",               "Recommendation Systems",    0]);
  const ip4 = await run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u8.lastID, "Software Engineering", "Professor", "UI/UX",                     "Human-Computer Interaction",1]);

  // PROJELEr
  const p1 = await run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp1.lastID, catCourse.category_id,    null,        "AI Chatbot",       "A smart assistant to support course-related communication.", 4, "Open"]);
  for (const sid of [await sk("React"), await sk("Node.js"), await sk("UI/UX")]) {
    await run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p1.lastID, sid]);
  }

  const p2 = await run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp2.lastID, catTubitak.category_id,   ip2.lastID,  "Mobile App",       "A mobile-first campus collaboration platform.",             5, "Advisor Assigned"]);
  for (const sid of [await sk("Flutter"), await sk("Firebase"), await sk("UX Research")]) {
    await run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p2.lastID, sid]);
  }

  const p3 = await run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp4.lastID, catTeknofest.category_id, ip3.lastID,  "Research Paper",   "An AI-focused paper on recommendation systems.",            3, "Needs Members"]);
  for (const sid of [await sk("Python"), await sk("Machine Learning"), await sk("Data Analysis")]) {
    await run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p3.lastID, sid]);
  }

  const p4 = await run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp1.lastID, catTubitak.category_id,   null,        "Smart Agriculture","Sensors and analytics dashboard for agricultural monitoring.", 4, "Open"]);
  for (const sid of [await sk("React"), await sk("Python"), await sk("IoT")]) {
    await run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p4.lastID, sid]);
  }

  // DANIŞMAN İSTEKLERİ
  await run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp1.lastID, ip1.lastID, p4.lastID, "Waiting"]);
  await run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp2.lastID, ip1.lastID, p2.lastID, "Waiting"]);
  await run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp3.lastID, ip2.lastID, p1.lastID, "Waiting"]);
  await run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp4.lastID, ip2.lastID, p3.lastID, "Accepted"]);

  // DUYURULAR
  await run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catTubitak.category_id,   u9.lastID, "TUBITAK Application Deadline Approaching", "Students who plan to apply should upload their proposal before the deadline."]);
  await run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catTeknofest.category_id, u9.lastID, "Teknofest Project Submissions Open",        "Teams can now create projects and invite members through the platform."]);
  await run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catCourse.category_id,    u9.lastID, "Course Project Group Formation Deadline",   "Students without a group after the deadline will be assigned automatically."]);

  console.log("✅ Veritabanı oluşturuldu, demo veriler eklendi.");
}

module.exports = { db, run, get, all, initDb };