import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import { db, initSchema } from "./db.js";

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function seedDatabase() {
  initSchema();

  const already = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (already > 0) return false;

  const hash = (p) => bcrypt.hashSync(p, 10);

  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)"
  );
  const insertTeacher = db.prepare(
    "INSERT INTO teachers (user_id, name, email, phone, subject) VALUES (?, ?, ?, ?, ?)"
  );
  const insertClass = db.prepare(
    "INSERT INTO classes (name, code, room, schedule, capacity, teacher_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertStudent = db.prepare(
    "INSERT INTO students (user_id, name, email, roll_no, class_id, guardian_name, guardian_phone, guardian_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertAssignment = db.prepare(
    "INSERT INTO assignments (class_id, title, description, due_date, max_score) VALUES (?, ?, ?, ?, ?)"
  );
  const insertGrade = db.prepare(
    "INSERT INTO grades (assignment_id, student_id, score, feedback) VALUES (?, ?, ?, ?)"
  );
  const insertAttendance = db.prepare(
    "INSERT INTO attendance (student_id, class_id, date, status, note) VALUES (?, ?, ?, ?, ?)"
  );
  const insertFee = db.prepare(
    "INSERT INTO fees (student_id, description, amount, due_date, status, paid_date, method) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const adminId = insertUser.run("System Admin", "admin@school.edu", hash("admin123"), "admin", "555-0100").lastInsertRowid;

  const teacherRows = [
    ["Amara Okafor", "amara@school.edu", "555-0111", "Mathematics"],
    ["David Chen", "david@school.edu", "555-0112", "Science"],
    ["Priya Nair", "priya@school.edu", "555-0113", "English"],
    ["Samuel Adeyemi", "samuel@school.edu", "555-0114", "History"],
  ];
  const teacherIds = [];
  for (const [name, email, phone, subject] of teacherRows) {
    const uid = insertUser.run(name, email, hash("teacher123"), "teacher", phone).lastInsertRowid;
    const tid = insertTeacher.run(uid, name, email, phone, subject).lastInsertRowid;
    teacherIds.push(tid);
  }

  const classRows = [
    ["Grade 10 - A", "G10A", "Room 101", "Mon/Wed/Fri 08:00-09:00", 35, teacherIds[0]],
    ["Grade 10 - B", "G10B", "Room 102", "Tue/Thu 09:00-10:00", 35, teacherIds[1]],
    ["Grade 11 - A", "G11A", "Room 201", "Mon/Wed 10:00-11:00", 30, teacherIds[2]],
    ["Grade 12 - A", "G12A", "Room 301", "Tue/Thu 11:00-12:00", 28, teacherIds[3]],
  ];
  const classIds = classRows.map((r) => insertClass.run(...r).lastInsertRowid);

  const studentRows = [
    ["Liam Johnson", "liam@student.edu", "G10A-01", classIds[0], "Mark Johnson", "555-0201", "parent@school.edu"],
    ["Sofia Martinez", "sofia@student.edu", "G10A-02", classIds[0], "Elena Martinez", "555-0202", "elena@mail.com"],
    ["Noah Williams", "noah@student.edu", "G10A-03", classIds[0], "Grace Williams", "555-0203", "grace@mail.com"],
    ["Emma Brown", "emma@student.edu", "G10B-01", classIds[1], "Tom Brown", "555-0204", "tom@mail.com"],
    ["Aarav Patel", "aarav@student.edu", "G10B-02", classIds[1], "Deepa Patel", "555-0205", "deepa@mail.com"],
    ["Olivia Garcia", "olivia@student.edu", "G11A-01", classIds[2], "Luis Garcia", "555-0206", "luis@mail.com"],
    ["Ethan Kim", "ethan@student.edu", "G11A-02", classIds[2], "Ji-won Kim", "555-0207", "jiwon@mail.com"],
    ["Mia Nguyen", "mia@student.edu", "G12A-01", classIds[3], "Lan Nguyen", "555-0208", "lan@mail.com"],
  ];
  const studentIds = [];
  studentRows.forEach((r, i) => {
    let uid = null;
    if (i === 0) {
      uid = insertUser.run(r[0], "student@school.edu", hash("student123"), "student", "555-0201").lastInsertRowid;
    }
    studentIds.push(insertStudent.run(uid, r[0], i === 0 ? "student@school.edu" : r[1], r[2], r[3], r[4], r[5], r[6]).lastInsertRowid);
  });

  insertUser.run("Mark Johnson", "parent@school.edu", hash("parent123"), "parent", "555-0201");
  insertUser.run("Elena Martinez", "elena@mail.com", hash("parent123"), "parent", "555-0202");

  const assignmentRows = [
    [classIds[0], "Algebra Quiz 1", "Quadratic equations", today(-5), 50],
    [classIds[0], "Geometry Project", "Triangles and circles", today(7), 100],
    [classIds[1], "Lab Report: Photosynthesis", "Write-up of the plant lab", today(-2), 100],
    [classIds[2], "Essay: Modern Literature", "1500 words", today(10), 100],
    [classIds[3], "History Term Paper", "World War II analysis", today(14), 100],
  ];
  const assignmentIds = assignmentRows.map((r) => insertAssignment.run(...r).lastInsertRowid);

  for (const sid of studentIds.slice(0, 3)) {
    insertGrade.run(assignmentIds[0], sid, 35 + Math.floor(Math.random() * 15), "Good work");
    insertGrade.run(assignmentIds[1], sid, 70 + Math.floor(Math.random() * 30), "Keep it up");
  }
  for (const sid of studentIds.slice(3, 5)) {
    insertGrade.run(assignmentIds[2], sid, 60 + Math.floor(Math.random() * 40), "");
  }
  for (const sid of studentIds.slice(5, 7)) {
    insertGrade.run(assignmentIds[3], sid, 55 + Math.floor(Math.random() * 45), "");
  }

  const statuses = ["present", "present", "present", "absent", "late", "present", "present", "excused"];
  for (let d = 1; d <= 10; d++) {
    const date = today(-d);
    studentIds.forEach((sid, idx) => {
      const student = db.prepare("SELECT class_id FROM students WHERE id = ?").get(sid);
      insertAttendance.run(sid, student.class_id, date, statuses[(idx + d) % statuses.length], null);
    });
  }

  studentIds.forEach((sid, idx) => {
    insertFee.run(sid, "Tuition - Term 1", 1500, today(-30), idx % 3 === 0 ? "paid" : idx % 3 === 1 ? "pending" : "overdue", idx % 3 === 0 ? today(-25) : null, idx % 3 === 0 ? "Bank Transfer" : null);
    insertFee.run(sid, "Library Fee", 50, today(5), idx % 2 === 0 ? "paid" : "pending", idx % 2 === 0 ? today(-3) : null, idx % 2 === 0 ? "Card" : null);
  });

  console.log("Database seeded:");
  console.log("  admin@school.edu / admin123");
  console.log("  amara@school.edu / teacher123");
  console.log("  student@school.edu / student123");
  console.log("  parent@school.edu / parent123");
  return true;
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect || process.argv.includes("--force-run")) {
  const created = seedDatabase();
  if (!created) console.log("Database already has data - skipping seed.");
}
