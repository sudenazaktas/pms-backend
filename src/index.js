const express = require("express");
const cors = require("cors");
const { initDb } = require("./data/db");

const authRoutes         = require("./routes/auth");
const projectRoutes      = require("./routes/projects");
const advisorRoutes      = require("./routes/advisors");
const requestRoutes      = require("./routes/requests");
const announcementRoutes = require("./routes/announcements");
const userRoutes         = require("./routes/users");

const app = express();
const PORT = 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/auth",          authRoutes);
app.use("/projects",      projectRoutes);
app.use("/advisors",      advisorRoutes);
app.use("/requests",      requestRoutes);
app.use("/announcements", announcementRoutes);
app.use("/users",         userRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 PMS Backend çalışıyor: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Veritabanı hatası:", err);
});