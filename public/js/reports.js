import { api, requireLogin, renderShell, escapeHtml, money } from "./common.js";

const user = requireLogin("admin");
renderShell("reports.html", "Reports");
const content = document.getElementById("content");

async function init() {
  const d = await api("/dashboard/reports");
  const collected = d.fee_summary.filter((f) => f.status === "paid").reduce((a, f) => a + f.total, 0);
  const pending = d.fee_summary.filter((f) => f.status === "pending").reduce((a, f) => a + f.total, 0);
  const overdue = d.fee_summary.filter((f) => f.status === "overdue").reduce((a, f) => a + f.total, 0);

  content.innerHTML =
    `<div class="page-head">
       <div><h2>Reports</h2><p class="muted">School-wide performance snapshot</p></div>
       <button class="btn" onclick="window.print()">Print / Save PDF</button>
     </div>
     <div class="grid cols-4" style="margin-bottom:20px">
       <div class="card stat"><span class="label">Total students</span><span class="value">${d.totals.students}</span></div>
       <div class="card stat"><span class="label">Total teachers</span><span class="value">${d.totals.teachers}</span></div>
       <div class="card stat"><span class="label">Classes</span><span class="value">${d.totals.classes}</span></div>
       <div class="card stat"><span class="label">Attendance rate</span><span class="value">${d.attendance_overall == null ? "-" : d.attendance_overall + "%"}</span></div>
     </div>

     <div class="card" style="margin-bottom:20px">
       <h3>Fee collection</h3>
       <div class="grid cols-3">
         <div class="stat"><span class="label">Collected</span><span class="value">${money(collected)}</span></div>
         <div class="stat"><span class="label">Pending</span><span class="value">${money(pending)}</span></div>
         <div class="stat"><span class="label">Overdue</span><span class="value">${money(overdue)}</span></div>
       </div>
     </div>

     <div class="card">
       <h3>Class performance</h3>
       <div class="table-wrap"><table>
         <thead><tr><th>Class</th><th>Code</th><th>Teacher</th><th>Students</th><th>Enrollment</th><th>Attendance</th><th>Avg grade</th></tr></thead>
         <tbody>${d.classes
           .map(
             (c) => `<tr>
               <td><strong>${escapeHtml(c.name)}</strong></td>
               <td>${escapeHtml(c.code)}</td>
               <td>${escapeHtml(c.teacher || "Unassigned")}</td>
               <td>${c.students} / ${c.capacity}</td>
               <td>${Math.round((c.students / c.capacity) * 100)}%</td>
               <td>${c.attendance_rate == null ? "-" : c.attendance_rate + "%"}</td>
               <td>${c.avg_grade == null ? "-" : c.avg_grade + "%"}</td>
             </tr>`
           )
           .join("")}</tbody></table></div>
     </div>`;
}

init().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
