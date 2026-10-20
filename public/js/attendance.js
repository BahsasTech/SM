import { api, requireLogin, renderShell, escapeHtml, fmtDate, statusBadge, toast } from "./common.js";

const user = requireLogin();
const isStaff = user.role === "admin" || user.role === "teacher";
renderShell("attendance.html", "Attendance");
const content = document.getElementById("content");
const today = new Date().toISOString().slice(0, 10);
const STATUSES = ["present", "absent", "late", "excused"];

async function init() {
  if (isStaff) await staffView();
  else await studentView();
}

/* ---------- Staff: mark attendance ---------- */
async function staffView() {
  const classes = await api("/classes");
  content.innerHTML =
    `<div class="page-head"><div><h2>Attendance</h2><p class="muted">Record and review daily attendance</p></div></div>
     <div class="card">
       <div class="toolbar">
         <div class="field"><label>Class</label><select id="cls">${classes
           .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`)
           .join("")}</select></div>
         <div class="field"><label>Date</label><input type="date" id="date" value="${today}"></div>
         <div class="spacer"></div>
         <button class="btn" id="allPresent">Mark all present</button>
       </div>
       <div id="roster"><div class="empty">Select a class and date.</div></div>
     </div>`;

  const refresh = () => loadRoster(document.getElementById("cls").value, document.getElementById("date").value);
  document.getElementById("cls").addEventListener("change", refresh);
  document.getElementById("date").addEventListener("change", refresh);
  document.getElementById("allPresent").addEventListener("click", () => {
    content.querySelectorAll("select[data-student]").forEach((s) => (s.value = "present"));
  });
  refresh();
}

async function loadRoster(classId, date) {
  const rosterEl = document.getElementById("roster");
  rosterEl.innerHTML = `<div class="empty">Loading...</div>`;
  const rows = await api(`/attendance?class_id=${classId}&date=${date}`);
  if (!rows.length) {
    rosterEl.innerHTML = `<div class="empty">No students in this class.</div>`;
    return;
  }
  rosterEl.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Roll No</th><th>Name</th><th>Status</th><th>Note</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.roll_no || "-")}</td>
            <td>${escapeHtml(r.name)}</td>
            <td><select data-student="${r.id}" style="min-width:130px">${STATUSES.map(
              (s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`
            ).join("")}</select></td>
            <td><input data-note="${r.id}" value="${escapeHtml(r.note || "")}" placeholder="optional"></td>
          </tr>`
        )
        .join("")}</tbody></table></div>
      <div style="margin-top:16px"><button class="btn primary" id="saveBtn">Save attendance</button></div>`;

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const records = [...rosterEl.querySelectorAll("select[data-student]")].map((sel) => ({
      student_id: Number(sel.dataset.student),
      status: sel.value,
      note: rosterEl.querySelector(`input[data-note="${sel.dataset.student}"]`)?.value || null,
    }));
    try {
      await api("/attendance/mark", { method: "POST", body: { class_id: Number(classId), date, records } });
      toast("Attendance saved");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

/* ---------- Student / Parent: view history ---------- */
async function studentView() {
  const students = await api("/students");
  if (!students.length) {
    content.innerHTML = `<div class="card empty">No student records linked to your account.</div>`;
    return;
  }
  content.innerHTML =
    `<div class="page-head"><div><h2>Attendance</h2><p class="muted">Your attendance history</p></div></div>
     <div class="card" style="margin-bottom:16px">
       <div class="field" style="max-width:320px"><label>Student</label>
         <select id="studentSel">${students
           .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
           .join("")}</select></div>
     </div>
     <div id="hist"></div>`;

  const load = () => loadHistory(document.getElementById("studentSel").value);
  document.getElementById("studentSel").addEventListener("change", load);
  load();
}

async function loadHistory(studentId) {
  const el = document.getElementById("hist");
  el.innerHTML = `<div class="empty">Loading...</div>`;
  const { records, summary } = await api(`/attendance/student/${studentId}`);
  const map = Object.fromEntries(summary.map((s) => [s.status, s.count]));
  const total = summary.reduce((a, s) => a + s.count, 0);
  const rate = total ? Math.round(((map.present || 0) + (map.late || 0)) / total * 100) : 0;

  el.innerHTML =
    `<div class="grid cols-4" style="margin-bottom:16px">
       <div class="card stat"><span class="label">Present</span><span class="value">${map.present || 0}</span></div>
       <div class="card stat"><span class="label">Absent</span><span class="value">${map.absent || 0}</span></div>
       <div class="card stat"><span class="label">Late</span><span class="value">${map.late || 0}</span></div>
       <div class="card stat"><span class="label">Attendance rate</span><span class="value">${rate}%</span></div>
     </div>` +
    (records.length
      ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Class</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${records
            .map(
              (r) => `<tr><td>${fmtDate(r.date)}</td><td>${escapeHtml(r.class_name || "-")}</td>
                <td>${statusBadge(r.status)}</td><td>${escapeHtml(r.note || "-")}</td></tr>`
            )
            .join("")}</tbody></table></div></div>`
      : `<div class="card empty">No attendance records.</div>`);
}

init().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
