const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new Database(path.join(__dirname, "../../pms.db"));

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

async function initDb() {
  run(`CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL
  )`);

  run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(role_id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS student_profiles (
    student_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id),
    department TEXT,
    year_level TEXT,
    bio TEXT,
    github_link TEXT,
    linkedin_link TEXT
  )`);

  run(`CREATE TABLE IF NOT EXISTS instructor_profiles (
    instructor_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id),
    department TEXT,
    academic_title TEXT,
    areas_of_expertise TEXT,
    research_interests TEXT,
    previous_supervised_projects INTEGER DEFAULT 0,
    is_available INTEGER DEFAULT 1
  )`);

  run(`CREATE TABLE IF NOT EXISTS project_categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT
  )`);

  run(`CREATE TABLE IF NOT EXISTS skills (
    skill_id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT UNIQUE NOT NULL
  )`);

  run(`CREATE TABLE IF NOT EXISTS projects (
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

  run(`CREATE TABLE IF NOT EXISTS project_roles (
    project_role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    role_name TEXT NOT NULL,
    count_needed INTEGER DEFAULT 1
  )`);

  run(`CREATE TABLE IF NOT EXISTS project_required_skills (
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    skill_id INTEGER NOT NULL REFERENCES skills(skill_id),
    PRIMARY KEY (project_id, skill_id)
  )`);

  run(`CREATE TABLE IF NOT EXISTS student_skills (
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    skill_id INTEGER NOT NULL REFERENCES skills(skill_id),
    PRIMARY KEY (student_profile_id, skill_id)
  )`);

  run(`CREATE TABLE IF NOT EXISTS advisor_requests (
    advisor_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    instructor_profile_id INTEGER NOT NULL REFERENCES instructor_profiles(instructor_profile_id),
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    status TEXT DEFAULT 'Waiting',
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`);

  run(`CREATE TABLE IF NOT EXISTS project_applications (
    application_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(student_profile_id),
    status TEXT DEFAULT 'Waiting',
    applied_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`);

  run(`CREATE TABLE IF NOT EXISTS announcements (
    announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES project_categories(category_id),
    created_by_user_id INTEGER REFERENCES users(user_id),
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  const roleCount = get("SELECT COUNT(*) as count FROM roles");
  if (roleCount.count > 0) return;

  run("INSERT INTO roles (role_name) VALUES (?)", ["student"]);
  run("INSERT INTO roles (role_name) VALUES (?)", ["advisor"]);
  run("INSERT INTO roles (role_name) VALUES (?)", ["admin"]);

  const studentRole = get("SELECT role_id FROM roles WHERE role_name = 'student'");
  const advisorRole = get("SELECT role_id FROM roles WHERE role_name = 'advisor'");
  const adminRole   = get("SELECT role_id FROM roles WHERE role_name = 'admin'");

  run("INSERT INTO project_categories (category_name) VALUES (?)", ["Course Project"]);
  run("INSERT INTO project_categories (category_name) VALUES (?)", ["TUBITAK"]);
  run("INSERT INTO project_categories (category_name) VALUES (?)", ["Teknofest"]);

  const catCourse    = get("SELECT category_id FROM project_categories WHERE category_name = 'Course Project'");
  const catTubitak   = get("SELECT category_id FROM project_categories WHERE category_name = 'TUBITAK'");
  const catTeknofest = get("SELECT category_id FROM project_categories WHERE category_name = 'Teknofest'");

  for (const s of ["React","Node.js","UI/UX","Flutter","Firebase","UX Research","Python","Machine Learning","Data Analysis","IoT"]) {
    run("INSERT OR IGNORE INTO skills (skill_name) VALUES (?)", [s]);
  }
  const sk = (name) => get("SELECT skill_id FROM skills WHERE skill_name = ?", [name]).skill_id;

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const u1 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "sevinc.yigit@ogr.university.edu.tr",   "Sevinc Yigit",        hash("123456")]);
  const u2 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "firdevs.su@ogr.university.edu.tr",     "Firdevs Su",          hash("123456")]);
  const u3 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "emre.guner@ogr.university.edu.tr",     "Emre Guner",          hash("123456")]);
  const u4 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [studentRole.role_id, "umut.kaya@ogr.university.edu.tr",      "Umut Kaya",           hash("123456")]);
  const u5 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "sila.korklubasoglu@university.edu.tr", "Sila Korklubasoglu",  hash("123456")]);
  const u6 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "selin.yuce@university.edu.tr",         "Prof. Selin Yuce",    hash("123456")]);
  const u7 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "mehmet.yildiz@university.edu.tr",      "Prof. Mehmet Yildiz", hash("123456")]);
  const u8 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [advisorRole.role_id, "duygu.dogan@university.edu.tr",        "Prof. Duygu Dogan",   hash("123456")]);
  const u9 = run("INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)", [adminRole.role_id,   "admin@university.edu.tr",              "System Admin",        hash("123456")]);

  const sp1 = run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u1.lastInsertRowid, "Software Engineering",   "3", "github.com/sevincyigit", "linkedin.com/in/sevincyigit"]);
  const sp2 = run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u2.lastInsertRowid, "Software Engineering",   "4", null, null]);
  const sp3 = run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u3.lastInsertRowid, "Electrical Engineering", "2", null, null]);
  const sp4 = run("INSERT INTO student_profiles (user_id, department, year_level, github_link, linkedin_link) VALUES (?, ?, ?, ?, ?)", [u4.lastInsertRowid, "Computer Engineering",   "4", null, null]);

  for (const sid of [sk("React"), sk("Python"), sk("UI/UX")]) {
    run("INSERT OR IGNORE INTO student_skills (student_profile_id, skill_id) VALUES (?, ?)", [sp1.lastInsertRowid, sid]);
  }

  const ip1 = run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u5.lastInsertRowid, "Software Engineering", "Professor", "Machine Learning, Python",   "NLP, Computer Vision",       1]);
  const ip2 = run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u6.lastInsertRowid, "Software Engineering", "Professor", "Artificial Intelligence",    "Deep Learning",              1]);
  const ip3 = run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u7.lastInsertRowid, "Computer Engineering", "Professor", "Data Mining",                "Recommendation Systems",     0]);
  const ip4 = run("INSERT INTO instructor_profiles (user_id, department, academic_title, areas_of_expertise, research_interests, is_available) VALUES (?, ?, ?, ?, ?, ?)", [u8.lastInsertRowid, "Software Engineering", "Professor", "UI/UX",                      "Human-Computer Interaction", 1]);

  const p1 = run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp1.lastInsertRowid, catCourse.category_id,    null,               "AI Chatbot",        "A smart assistant to support course-related communication.", 4, "Open"]);
  for (const sid of [sk("React"), sk("Node.js"), sk("UI/UX")]) {
    run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p1.lastInsertRowid, sid]);
  }

  const p2 = run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp2.lastInsertRowid, catTubitak.category_id,   ip2.lastInsertRowid, "Mobile App",        "A mobile-first campus collaboration platform.",             5, "Advisor Assigned"]);
  for (const sid of [sk("Flutter"), sk("Firebase"), sk("UX Research")]) {
    run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p2.lastInsertRowid, sid]);
  }

  const p3 = run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp4.lastInsertRowid, catTeknofest.category_id, ip3.lastInsertRowid, "Research Paper",    "An AI-focused paper on recommendation systems.",            3, "Needs Members"]);
  for (const sid of [sk("Python"), sk("Machine Learning"), sk("Data Analysis")]) {
    run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p3.lastInsertRowid, sid]);
  }

  const p4 = run("INSERT INTO projects (owner_student_profile_id, category_id, assigned_instructor_profile_id, title, description, team_size, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [sp1.lastInsertRowid, catTubitak.category_id,   null,               "Smart Agriculture", "Sensors and analytics dashboard for agricultural monitoring.", 4, "Open"]);
  for (const sid of [sk("React"), sk("Python"), sk("IoT")]) {
    run("INSERT OR IGNORE INTO project_required_skills (project_id, skill_id) VALUES (?, ?)", [p4.lastInsertRowid, sid]);
  }

  run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp1.lastInsertRowid, ip1.lastInsertRowid, p4.lastInsertRowid, "Waiting"]);
  run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp2.lastInsertRowid, ip1.lastInsertRowid, p2.lastInsertRowid, "Waiting"]);
  run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp3.lastInsertRowid, ip2.lastInsertRowid, p1.lastInsertRowid, "Waiting"]);
  run("INSERT INTO advisor_requests (student_profile_id, instructor_profile_id, project_id, status) VALUES (?, ?, ?, ?)", [sp4.lastInsertRowid, ip2.lastInsertRowid, p3.lastInsertRowid, "Accepted"]);

  run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catTubitak.category_id,   u9.lastInsertRowid, "TUBITAK Application Deadline Approaching", "Students who plan to apply should upload their proposal before the deadline."]);
  run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catTeknofest.category_id, u9.lastInsertRowid, "Teknofest Project Submissions Open",        "Teams can now create projects and invite members through the platform."]);
  run("INSERT INTO announcements (category_id, created_by_user_id, title, description) VALUES (?, ?, ?, ?)", [catCourse.category_id,    u9.lastInsertRowid, "Course Project Group Formation Deadline",   "Students without a group after the deadline will be assigned automatically."]);

  console.log("✅ Veritabanı oluşturuldu, demo veriler eklendi.");
}

module.exports = { db, run, get, all, initDb };