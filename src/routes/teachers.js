import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "teacher"));

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM teachers ORDER BY name").all();
  res.json(rows);
});

router.post("/", requireRole("admin"), (req, res) => {
  const { name, email, phone, subject, create_login } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });

  let user_id = null;
  if (create_login && email) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(String(email).toLowerCase());
    if (existing) {
      user_id = existing.id;
    } else {
      user_id = db
        .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'teacher')")
        .run(name, String(email).toLowerCase(), bcrypt.hashSync("teacher123", 10)).lastInsertRowid;
    }
  }

  const info = db
    .prepare("INSERT INTO teachers (user_id, name, email, phone, subject) VALUES (?, ?, ?, ?, ?)")
    .run(user_id, name, email || null, phone || null, subject || null);
  res.status(201).json(db.prepare("SELECT * FROM teachers WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const existing = db.prepare("SELECT * FROM teachers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Teacher not found" });
  const { name, email, phone, subject } = req.body || {};
  db.prepare("UPDATE teachers SET name = ?, email = ?, phone = ?, subject = ? WHERE id = ?").run(
    name ?? existing.name,
    email ?? existing.email,
    phone ?? existing.phone,
    subject ?? existing.subject,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM teachers WHERE id = ?").get(req.params.id));
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM teachers WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Teacher not found" });
  res.json({ ok: true });
});

export default router;
