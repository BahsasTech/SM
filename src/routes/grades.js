import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { canAccessStudent, teacherIdForUser } from "../helpers.js";

const router = Router();
router.use(requireAuth);

function decorateAssignment(a) {
  const klass = db.prepare("SELECT id, name, code FROM classes WHERE id = ?").get(a.class_id);
  const graded = db.prepare("SELECT COUNT(*) AS c FROM grades WHERE assignment_id = ?").get(a.id).c;
  const total = db.prepare("SELECT COUNT(*) AS c FROM students WHERE class_id = ?").get(a.class_id).c;
  return { ...a, class: klass, graded_count: graded, student_count: total };
}

router.get("/assignments", (req, res) => {
  const { class_id } = req.query;
  const rows = class_id
    ? db.prepare("SELECT * FROM assignments WHERE class_id = ? ORDER BY due_date").all(class_id)
    : db.prepare("SELECT * FROM assignments ORDER BY due_date").all();
  res.json(rows.map(decorateAssignment));
});

router.post("/assignments", requireRole("admin", "teacher"), (req, res) => {
  const { class_id, title, description, due_date, max_score } = req.body || {};
  if (!class_id || !title) return res.status(400).json({ error: "class_id and title are required" });
  const info = db
    .prepare("INSERT INTO assignments (class_id, title, description, due_date, max_score) VALUES (?, ?, ?, ?, ?)")
    .run(class_id, title, description || null, due_date || null, max_score || 100);
  res.status(201).json(decorateAssignment(db.prepare("SELECT * FROM assignments WHERE id = ?").get(info.lastInsertRowid)));
});

router.put("/assignments/:id", requireRole("admin", "teacher"), (req, res) => {
  const existing = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Assignment not found" });
  const { title, description, due_date, max_score } = req.body || {};
  db.prepare("UPDATE assignments SET title = ?, description = ?, due_date = ?, max_score = ? WHERE id = ?").run(
    title ?? existing.title,
    description ?? existing.description,
    due_date ?? existing.due_date,
    max_score ?? existing.max_score,
    req.params.id
  );
  res.json(decorateAssignment(db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id)));
});

router.delete("/assignments/:id", requireRole("admin", "teacher"), (req, res) => {
  const info = db.prepare("DELETE FROM assignments WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Assignment not found" });
  res.json({ ok: true });
});

router.get("/assignments/:id/grades", requireRole("admin", "teacher"), (req, res) => {
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id);
  if (!assignment) return res.status(404).json({ error: "Assignment not found" });
  const roster = db
    .prepare(
      `SELECT s.id AS student_id, s.name, s.roll_no, g.score, g.feedback
       FROM students s
       LEFT JOIN grades g ON g.student_id = s.id AND g.assignment_id = ?
       WHERE s.class_id = ? ORDER BY s.name`
    )
    .all(req.params.id, assignment.class_id);
  res.json({ assignment, roster });
});

router.post("/assignments/:id/grades", requireRole("admin", "teacher"), (req, res) => {
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id);
  if (!assignment) return res.status(404).json({ error: "Assignment not found" });
  const { records } = req.body || {};
  if (!Array.isArray(records)) return res.status(400).json({ error: "records[] is required" });
  const upsert = db.prepare(
    `INSERT INTO grades (assignment_id, student_id, score, feedback)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(assignment_id, student_id) DO UPDATE SET score = excluded.score, feedback = excluded.feedback`
  );
  db.exec("BEGIN");
  try {
    for (const r of records) {
      if (!r.student_id) continue;
      const score = r.score === "" || r.score === null || r.score === undefined ? null : Number(r.score);
      upsert.run(assignment.id, r.student_id, score, r.feedback || null);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  res.json({ ok: true, saved: records.length });
});

router.get("/student/:id", (req, res) => {
  if (!canAccessStudent(req.user, req.params.id)) return res.status(403).json({ error: "Forbidden" });
  const rows = db
    .prepare(
      `SELECT g.id, g.score, g.feedback, a.title, a.max_score, a.due_date, c.name AS class_name
       FROM grades g
       JOIN assignments a ON a.id = g.assignment_id
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE g.student_id = ? ORDER BY a.due_date DESC`
    )
    .all(req.params.id);

  const avg = rows
    .filter((r) => r.score !== null)
    .map((r) => (r.score / r.max_score) * 100);
  const average = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : null;
  res.json({ records: rows, average_percent: average });
});

export default router;
