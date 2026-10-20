import { db } from "./db.js";

export function getStudentForUser(user) {
  return db.prepare("SELECT * FROM students WHERE user_id = ?").get(user.id);
}

export function getChildrenForParent(user) {
  return db.prepare("SELECT * FROM students WHERE guardian_email = ?").all(user.email);
}

export function getStudentsVisibleTo(user) {
  if (user.role === "admin" || user.role === "teacher") {
    return db.prepare("SELECT * FROM students ORDER BY name").all();
  }
  if (user.role === "parent") return getChildrenForParent(user);
  const s = getStudentForUser(user);
  return s ? [s] : [];
}

export function canAccessStudent(user, studentId) {
  if (user.role === "admin" || user.role === "teacher") return true;
  return getStudentsVisibleTo(user).some((s) => s.id === Number(studentId));
}

export function teacherIdForUser(user) {
  const t = db.prepare("SELECT id FROM teachers WHERE user_id = ?").get(user.id);
  return t ? t.id : null;
}
