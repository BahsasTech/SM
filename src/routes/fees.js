import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();
router.use(requireAuth);

function decorate(row) {
  const student = db.prepare("SELECT id, name, roll_no FROM students WHERE id = ?").get(row.student_id);
  return { ...row, student };
}

router.get("/", (req, res) => {
  let rows;
  if (req.user.role === "admin" || req.user.role === "teacher") {
    rows = db.prepare("SELECT * FROM fees ORDER BY due_date DESC").all();
  } else if (req.user.role === "parent") {
    rows = db.prepare(
      `SELECT f.* FROM fees f JOIN students s ON s.id = f.student_id WHERE s.guardian_email = ? ORDER BY f.due_date DESC`
    ).all(req.user.email);
  } else {
    rows = db.prepare(
      `SELECT f.* FROM fees f JOIN students s ON s.id = f.student_id WHERE s.user_id = ? ORDER BY f.due_date DESC`
    ).all(req.user.id);
  }
  res.json(rows.map(decorate));
});

router.get("/summary", (req, res) => {
  const summary = db
    .prepare("SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total FROM fees GROUP BY status")
    .all();
  res.json(summary);
});

router.post("/", requireRole("admin"), (req, res) => {
  const { student_id, description, amount, due_date, status } = req.body || {};
  if (!student_id || !description) return res.status(400).json({ error: "student_id and description are required" });
  const info = db
    .prepare("INSERT INTO fees (student_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)")
    .run(student_id, description, Number(amount) || 0, due_date || null, status || "pending");
  res.status(201).json(decorate(db.prepare("SELECT * FROM fees WHERE id = ?").get(info.lastInsertRowid)));
});

router.post("/:id/pay", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM fees WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Fee record not found" });
  const method = (req.body && req.body.method) || "Cash";
  const paidDate = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE fees SET status = 'paid', paid_date = ?, method = ? WHERE id = ?").run(paidDate, method, req.params.id);
  res.json(decorate(db.prepare("SELECT * FROM fees WHERE id = ?").get(req.params.id)));
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM fees WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Fee record not found" });
  const { description, amount, due_date, status } = req.body || {};
  db.prepare("UPDATE fees SET description = ?, amount = ?, due_date = ?, status = ? WHERE id = ?").run(
    description ?? existing.description,
    amount ?? existing.amount,
    due_date ?? existing.due_date,
    status ?? existing.status,
    req.params.id
  );
  res.json(decorate(db.prepare("SELECT * FROM fees WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM fees WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Fee record not found" });
  res.json({ ok: true });
});

export default router;
