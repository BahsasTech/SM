import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();
router.use(requireAuth);

function decorate(row) {
  const teacher = row.teacher_id
    ? db.prepare("SELECT id, name, subject FROM teachers WHERE id = ?").get(row.teacher_id)
    : null;
  const count = db.prepare("SELECT COUNT(*) AS c FROM students WHERE class_id = ?").get(row.id).c;
  return { ...row, teacher, student_count: count };
}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM classes ORDER BY name").all();
  res.json(rows.map(decorate));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Class not found" });
  const students = db.prepare("SELECT * FROM students WHERE class_id = ? ORDER BY name").all(row.id);
  res.json({ ...decorate(row), students });
});

router.post("/", requireRole("admin"), (req, res) => {
  const { name, code, room, schedule, capacity, teacher_id } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Name and code are required" });
  try {
    const info = db
      .prepare("INSERT INTO classes (name, code, room, schedule, capacity, teacher_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(name, code, room || null, schedule || null, capacity || 40, teacher_id || null);
    res.status(201).json(decorate(db.prepare("SELECT * FROM classes WHERE id = ?").get(info.lastInsertRowid)));
  } catch (e) {
    res.status(400).json({ error: "A class with that code already exists" });
  }
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Class not found" });
  const { name, code, room, schedule, capacity, teacher_id } = req.body || {};
  db.prepare(
    "UPDATE classes SET name = ?, code = ?, room = ?, schedule = ?, capacity = ?, teacher_id = ? WHERE id = ?"
  ).run(
    name ?? existing.name,
    code ?? existing.code,
    room ?? existing.room,
    schedule ?? existing.schedule,
    capacity ?? existing.capacity,
    teacher_id === undefined ? existing.teacher_id : teacher_id || null,
    req.params.id
  );
  res.json(decorate(db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM classes WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Class not found" });
  res.json({ ok: true });
});

export default router;
