import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, "..", "data", "school.db");

import { mkdirSync } from "node:fs";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','teacher','student','parent')),
      phone         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      code       TEXT NOT NULL UNIQUE,
      room       TEXT,
      schedule   TEXT,
      capacity   INTEGER DEFAULT 40,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name     TEXT NOT NULL,
      email    TEXT,
      phone    TEXT,
      subject  TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      email          TEXT,
      roll_no        TEXT,
      class_id       INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      guardian_name  TEXT,
      guardian_phone TEXT,
      guardian_email TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id   INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      date       TEXT NOT NULL,
      status     TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
      note       TEXT,
      UNIQUE (student_id, date)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      due_date    TEXT,
      max_score   INTEGER NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS grades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      score         REAL,
      feedback      TEXT,
      UNIQUE (assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS fees (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount      REAL NOT NULL DEFAULT 0,
      due_date    TEXT,
      status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
      paid_date   TEXT,
      method      TEXT
    );
  `);
}
