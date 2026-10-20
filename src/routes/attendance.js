import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { canAccessStudent } from "../helpers.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.status(400).json({ error: "class_id and date are required" });
  const students = db.prepare("SELECT id, name, roll_no FROM students WHERE class_id = ? ORDER BY name").all(class_id);
  const records = db.prepare("SELECT student_id, status, note FROM attendance WHERE class_id = ? AND date = ?").all(class_id, date);
  const map = new Map(records.map((r) => [r.student_id, r]));
  res.json(
    students.map((s) => ({
      ...s,
      status: map.get(s.id)?.status || null,
      note: map.get(s.id)?.note || null,
    }))
  );
});

router.get("/student/:id", (req, res) => {
  if (!canAccessStudent(req.user, req.params.id)) return res.status(403).json({ error: "Forbidden" });
  const rows = db
    .prepare(
      `SELECT a.*, c.name AS class_name FROM attendance a
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.student_id = ? ORDER BY a.date DESC`
    )
    .all(req.params.id);
  const summary = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM attendance WHERE student_id = ? GROUP BY status`
    )
    .all(req.params.id);
  res.json({ records: rows, summary });
});

router.post("/mark", requireRole("admin", "teacher"), (req, res) => {
  const { class_id, date, records } = req.body || {};
  if (!class_id || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: "class_id, date and records[] are required" });
  }
  const upsert = db.prepare(
    `INSERT INTO attendance (student_id, class_id, date, status, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, note = excluded.note, class_id = excluded.class_id`
  );
  db.exec("BEGIN");
  try {
    for (const r of records) {
      if (!r.student_id || !r.status) continue;
      upsert.run(r.student_id, class_id, date, r.status, r.note || null);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  res.json({ ok: true, saved: records.length });
});

export default router;
