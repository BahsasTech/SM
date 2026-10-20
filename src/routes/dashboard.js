import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { getStudentsVisibleTo } from "../helpers.js";

const router = Router();
router.use(requireAuth);

router.get("/reports", requireRole("admin"), (_req, res) => {
  const classes = db.prepare("SELECT * FROM classes ORDER BY name").all().map((c) => {
    const teacher = c.teacher_id ? db.prepare("SELECT name FROM teachers WHERE id = ?").get(c.teacher_id) : null;
    const students = db.prepare("SELECT id FROM students WHERE class_id = ?").all(c.id).map((s) => s.id);
    const studentCount = students.length;

    let attendanceRate = null;
    if (studentCount) {
      const ph = students.map(() => "?").join(",");
      const att = db
        .prepare(
          `SELECT SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present, COUNT(*) AS total
           FROM attendance WHERE student_id IN (${ph})`
        )
        .get(...students);
      attendanceRate = att.total ? Math.round((att.present / att.total) * 100) : null;
    }

    let avgGrade = null;
    if (studentCount) {
      const ph = students.map(() => "?").join(",");
      const g = db
        .prepare(
          `SELECT AVG(g.score * 100.0 / a.max_score) AS avg
           FROM grades g JOIN assignments a ON a.id = g.assignment_id
           WHERE g.student_id IN (${ph}) AND g.score IS NOT NULL`
        )
        .get(...students);
      avgGrade = g.avg == null ? null : Math.round(g.avg);
    }

    return {
      id: c.id, name: c.name, code: c.code,
      teacher: teacher ? teacher.name : null,
      students: studentCount, capacity: c.capacity,
      attendance_rate: attendanceRate, avg_grade: avgGrade,
    };
  });

  const feeSummary = db
    .prepare("SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fees GROUP BY status")
    .all();

  const overall = db
    .prepare(
      `SELECT SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present, COUNT(*) AS total FROM attendance`
    )
    .get();

  res.json({
    classes,
    fee_summary: feeSummary,
    attendance_overall: overall.total ? Math.round((overall.present / overall.total) * 100) : null,
    totals: {
      students: db.prepare("SELECT COUNT(*) AS c FROM students").get().c,
      teachers: db.prepare("SELECT COUNT(*) AS c FROM teachers").get().c,
      classes: db.prepare("SELECT COUNT(*) AS c FROM classes").get().c,
    },
  });
});

router.get("/stats", (req, res) => {
  if (req.user.role === "admin" || req.user.role === "teacher") {
    const students = db.prepare("SELECT COUNT(*) AS c FROM students").get().c;
    const teachers = db.prepare("SELECT COUNT(*) AS c FROM teachers").get().c;
    const classes = db.prepare("SELECT COUNT(*) AS c FROM classes").get().c;
    const assignments = db.prepare("SELECT COUNT(*) AS c FROM assignments").get().c;

    const todayStr = new Date().toISOString().slice(0, 10);
    const att = db
      .prepare(
        `SELECT status, COUNT(*) AS count FROM attendance WHERE date = ? GROUP BY status`
      )
      .all(todayStr);
    const todayTotal = att.reduce((s, r) => s + r.count, 0);

    const feeRows = db.prepare("SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fees GROUP BY status").all();
    const collected = feeRows.filter((f) => f.status === "paid").reduce((s, f) => s + f.total, 0);
    const outstanding = feeRows.filter((f) => f.status !== "paid").reduce((s, f) => s + f.total, 0);

    const attendanceTrend = db
      .prepare(
        `SELECT date,
           SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present,
           COUNT(*) AS total
         FROM attendance GROUP BY date ORDER BY date DESC LIMIT 14`
      )
      .all()
      .reverse();

    const recentFees = db
      .prepare("SELECT f.*, s.name AS student_name FROM fees f JOIN students s ON s.id = f.student_id ORDER BY f.due_date DESC LIMIT 6")
      .all();

    return res.json({
      role: req.user.role,
      students, teachers, classes, assignments,
      attendance_today: {
        total: todayTotal,
        present: att.filter((a) => a.status === "present" || a.status === "late").reduce((s, a) => s + a.count, 0),
        absent: att.filter((a) => a.status === "absent").reduce((s, a) => s + a.count, 0),
        by_status: att,
      },
      fees: { collected, outstanding, by_status: feeRows },
      attendance_trend: attendanceTrend.map((r) => ({ date: r.date, rate: r.total ? Math.round((r.present / r.total) * 100) : 0 })),
      recent_fees: recentFees,
    });
  }

  const visible = getStudentsVisibleTo(req.user);
  const ids = visible.map((s) => s.id);
  if (!ids.length) {
    return res.json({ role: req.user.role, students: [], average_percent: null, attendance_rate: null, pending_fees: 0, records: [] });
  }
  const placeholders = ids.map(() => "?").join(",");

  const grades = db
    .prepare(
      `SELECT g.score, a.max_score FROM grades g JOIN assignments a ON a.id = g.assignment_id WHERE g.student_id IN (${placeholders}) AND g.score IS NOT NULL`
    )
    .all(...ids);
  const average = grades.length
    ? Math.round(grades.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / grades.length)
    : null;

  const att = db
    .prepare(
      `SELECT SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present, COUNT(*) AS total FROM attendance WHERE student_id IN (${placeholders})`
    )
    .get(...ids);
  const attendanceRate = att.total ? Math.round((att.present / att.total) * 100) : null;

  const pending = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM fees WHERE student_id IN (${placeholders}) AND status != 'paid'`
    )
    .get(...ids).total;

  const upcoming = db
    .prepare(
      `SELECT a.title, a.due_date, c.name AS class_name, s.name AS student_name
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       JOIN students s ON s.class_id = a.class_id
       WHERE s.id IN (${placeholders}) AND a.due_date >= date('now')
       ORDER BY a.due_date LIMIT 6`
    )
    .all(...ids);

  res.json({
    role: req.user.role,
    students: visible.map((s) => ({ id: s.id, name: s.name, roll_no: s.roll_no })),
    average_percent: average,
    attendance_rate: attendanceRate,
    pending_fees: pending,
    upcoming_assignments: upcoming,
  });
});

export default router;
