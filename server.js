import "./src/env.js";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { initSchema } from "./src/db.js";
import { seedDatabase } from "./src/seed.js";
import authRoutes from "./src/routes/auth.js";
import studentRoutes from "./src/routes/students.js";
import teacherRoutes from "./src/routes/teachers.js";
import classRoutes from "./src/routes/classes.js";
import attendanceRoutes from "./src/routes/attendance.js";
import gradeRoutes from "./src/routes/grades.js";
import feeRoutes from "./src/routes/fees.js";
import dashboardRoutes from "./src/routes/dashboard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

initSchema();
seedDatabase();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`School Management System running at http://localhost:${PORT}`);
});
