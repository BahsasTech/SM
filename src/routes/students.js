import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { canAccessStudent } from "../helpers.js";

const router = Router();
router.use(requireAuth);

function withClass(row) {
  const klass = row.class_id
    ? db.prepare("SELECT id, name, code FROM classes WHERE id = ?").get(row.class_id)
    : null;
  return { ...row, class: klass };
}

router.get("/", (req, res) => {
  let rows;
  if (req.user.role === "admin" || req.user.role === "teacher") {
    rows = db.prepare("SELECT * FROM students ORDER BY name").all();
  } else if (req.user.role === "parent") {
    rows = db.prepare("SELECT * FROM students WHERE guardian_email = ? ORDER BY name").all(req.user.email);
  } else {
    rows = db.prepare("SELECT * FROM students WHERE user_id = ?").all(req.user.id);
  }
  res.json(rows.map(withClass));
});

router.get("/:id", (req, res) => {
  if (!canAccessStudent(req.user, req.params.id)) return res.status(403).json({ error: "Forbidden" });
  const row = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Student not found" });
  res.json(withClass(row));
});

router.post("/", requireRole("admin"), (req, res) => {
  const { name, email, roll_no, class_id, guardian_name, guardian_phone, guardian_email, create_login } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });

  let user_id = null;
  if (create_login && email) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(String(email).toLowerCase());
    if (existing) {
      user_id = existing.id;
    } else {
      user_id = db
        .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')")
        .run(name, String(email).toLowerCase(), bcrypt.hashSync("student123", 10)).lastInsertRowid;
    }
  }

  const info = db
    .prepare(
      `INSERT INTO students (user_id, name, email, roll_no, class_id, guardian_name, guardian_phone, guardian_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(user_id, name, email || null, roll_no || null, class_id || null, guardian_name || null, guardian_phone || null, guardian_email || null);

  res.status(201).json(withClass(db.prepare("SELECT * FROM students WHERE id = ?").get(info.lastInsertRowid)));
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Student not found" });
  const { name, email, roll_no, class_id, guardian_name, guardian_phone, guardian_email } = req.body || {};
  db.prepare(
    `UPDATE students SET name = ?, email = ?, roll_no = ?, class_id = ?, guardian_name = ?, guardian_phone = ?, guardian_email = ?
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    email ?? existing.email,
    roll_no ?? existing.roll_no,
    class_id ?? existing.class_id,
    guardian_name ?? existing.guardian_name,
    guardian_phone ?? existing.guardian_phone,
    guardian_email ?? existing.guardian_email,
    req.params.id
  );
  res.json(withClass(db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Student not found" });
  res.json({ ok: true });
});

export default router;
