import { api, requireLogin, renderShell, escapeHtml, money, fmtDate, statusBadge } from "./common.js";

const user = requireLogin();
renderShell("dashboard.html", "Dashboard");

const content = document.getElementById("content");

function statCard(label, value, hint) {
  return `<div class="card stat"><span class="label">${label}</span>
    <span class="value">${value}</span><span class="hint">${hint || ""}</span></div>`;
}

async function load() {
  const data = await api("/dashboard/stats");
  if (user.role === "admin" || user.role === "teacher") renderStaff(data);
  else renderStudent(data);
}

function renderStaff(d) {
  const att = d.attendance_today;
  const rate = att.total ? Math.round((att.present / att.total) * 100) : 0;
  const cards = `
    <div class="grid cols-4">
      ${statCard("Students", d.students, "enrolled")}
      ${statCard("Teachers", d.teachers, "on staff")}
      ${statCard("Classes", d.classes, "active")}
      ${statCard("Assignments", d.assignments, "created")}
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      ${statCard("Attendance today", rate + "%", att.present + " present / " + att.total)}
      ${statCard("Fees collected", money(d.fees.collected), "all time")}
      ${statCard("Outstanding", money(d.fees.outstanding), "unpaid")}
    </div>`;

  const trend = d.attendance_trend || [];
  const trendHtml = trend.length
    ? `<div class="grid" style="gap:10px">${trend
        .map(
          (t) => `<div style="display:flex;align-items:center;gap:12px">
            <span class="muted" style="width:96px">${fmtDate(t.date)}</span>
            <div class="bar" style="flex:1"><span style="width:${t.rate}%"></span></div>
            <span style="width:44px;text-align:right">${t.rate}%</span>
          </div>`
        )
        .join("")}</div>`
    : `<p class="empty">No attendance recorded yet.</p>`;

  const fees = d.recent_fees || [];
  const feesHtml = fees.length
    ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>${fees
          .map(
            (f) => `<tr><td>${escapeHtml(f.student_name)}</td><td>${escapeHtml(f.description)}</td>
            <td>${money(f.amount)}</td><td>${fmtDate(f.due_date)}</td><td>${statusBadge(f.status)}</td></tr>`
          )
          .join("")}</tbody></table></div>`
    : `<p class="empty">No fee records.</p>`;

  content.innerHTML = `${cards}
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>Attendance trend (last 14 days)</h3>${trendHtml}</div>
      <div class="card"><h3>Recent fees</h3>${feesHtml}</div>
    </div>`;
}

function renderStudent(d) {
  const cards = `
    <div class="grid cols-3">
      ${statCard("Average grade", d.average_percent == null ? "-" : d.average_percent + "%", "across assignments")}
      ${statCard("Attendance", d.attendance_rate == null ? "-" : d.attendance_rate + "%", "present or late")}
      ${statCard("Pending fees", money(d.pending_fees), "amount due")}
    </div>`;

  let studentsHtml = "";
  if (d.students && d.students.length) {
    studentsHtml = `<div class="card" style="margin-top:16px"><h3>${user.role === "parent" ? "Children" : "Enrollment"}</h3>
      ${d.students.map((s) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
        <span>${escapeHtml(s.name)}</span><span class="muted">${escapeHtml(s.roll_no || "")}</span></div>`).join("")}</div>`;
  }

  const up = d.upcoming_assignments || [];
  const upHtml = up.length
    ? `<div class="table-wrap"><table><thead><tr><th>Assignment</th>${user.role === "parent" ? "<th>Student</th>" : ""}<th>Class</th><th>Due</th></tr></thead>
       <tbody>${up
         .map(
           (a) => `<tr><td>${escapeHtml(a.title)}</td>${user.role === "parent" ? `<td>${escapeHtml(a.student_name)}</td>` : ""}
           <td>${escapeHtml(a.class_name || "-")}</td><td>${fmtDate(a.due_date)}</td></tr>`
         )
         .join("")}</tbody></table></div>`
    : `<p class="empty">No upcoming assignments.</p>`;

  content.innerHTML = `${cards}${studentsHtml}
    <div class="card" style="margin-top:16px"><h3>Upcoming assignments</h3>${upHtml}</div>`;
}

load().catch((e) => {
  content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
});
