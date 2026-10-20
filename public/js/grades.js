import { api, requireLogin, renderShell, escapeHtml, fmtDate, toast, openModal } from "./common.js";

const user = requireLogin();
const isStaff = user.role === "admin" || user.role === "teacher";
renderShell("grades.html", isStaff ? "Grades & Assignments" : "My Grades");
const content = document.getElementById("content");

async function init() {
  if (isStaff) await staffView();
  else await studentView();
}

/* ---------- Staff ---------- */
async function staffView() {
  const [classes, assignments] = await Promise.all([api("/classes"), api("/grades/assignments")]);

  content.innerHTML =
    `<div class="page-head"><div><h2>Assignments</h2><p class="muted">${assignments.length} assignment(s)</p></div>
      <button class="btn primary" id="addBtn">+ New assignment</button></div>
     <div class="card"><div class="table-wrap"><table>
       <thead><tr><th>Title</th><th>Class</th><th>Due</th><th>Max</th><th>Graded</th><th></th></tr></thead>
       <tbody>${
         assignments.length
           ? assignments
               .map(
                 (a) => `<tr>
                   <td><strong>${escapeHtml(a.title)}</strong><div class="muted">${escapeHtml(a.description || "")}</div></td>
                   <td>${a.class ? escapeHtml(a.class.name) : "-"}</td>
                   <td>${fmtDate(a.due_date)}</td>
                   <td>${a.max_score}</td>
                   <td>${a.graded_count} / ${a.student_count}</td>
                   <td style="white-space:nowrap">
                     <button class="btn sm primary" data-grade="${a.id}">Grade</button>
                     <button class="btn sm" data-edit="${a.id}">Edit</button>
                     <button class="btn sm danger" data-del="${a.id}">Delete</button>
                   </td>
                 </tr>`
               )
               .join("")
           : `<tr><td colspan="6" class="empty">No assignments yet.</td></tr>`
       }</tbody></table></div></div>`;

  document.getElementById("addBtn").addEventListener("click", () => assignmentForm(null, classes, init));
  content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => assignmentForm(assignments.find((a) => a.id == b.dataset.edit), classes, init)));
  content.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this assignment and its grades?")) return;
      try {
        await api(`/grades/assignments/${b.dataset.del}`, { method: "DELETE" });
        toast("Assignment deleted");
        init();
      } catch (e) {
        toast(e.message, "error");
      }
    })
  );
  content.querySelectorAll("[data-grade]").forEach((b) => b.addEventListener("click", () => gradeModal(b.dataset.grade)));
}

function assignmentForm(a, classes, done) {
  openModal(
    `<h3>${a ? "Edit" : "New"} assignment</h3>
     <form id="aForm">
       <div class="field"><label>Class *</label><select name="class_id" ${a ? "disabled" : ""}>${classes
         .map((c) => `<option value="${c.id}" ${a && a.class_id === c.id ? "selected" : ""}>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`)
         .join("")}</select></div>
       <div class="field"><label>Title *</label><input name="title" value="${escapeHtml(a?.title || "")}" required></div>
       <div class="field"><label>Description</label><textarea name="description" rows="2">${escapeHtml(a?.description || "")}</textarea></div>
       <div class="form-row">
         <div class="field"><label>Due date</label><input name="due_date" type="date" value="${a?.due_date || ""}"></div>
         <div class="field"><label>Max score</label><input name="max_score" type="number" min="1" value="${a?.max_score || 100}"></div>
       </div>
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#aForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          body.max_score = Number(body.max_score) || 100;
          if (a) delete body.class_id;
          else body.class_id = Number(body.class_id);
          try {
            if (a) await api(`/grades/assignments/${a.id}`, { method: "PUT", body });
            else await api("/grades/assignments", { method: "POST", body });
            toast("Saved");
            close();
            done();
          } catch (err) {
            toast(err.message, "error");
          }
        });
      },
    }
  );
}

async function gradeModal(assignmentId) {
  const { assignment, roster } = await api(`/grades/assignments/${assignmentId}/grades`);
  openModal(
    `<h3>Grade: ${escapeHtml(assignment.title)}</h3>
     <p class="muted" style="margin-top:-10px">Max score: ${assignment.max_score}</p>
     <div style="max-height:50vh;overflow:auto">
       <table><thead><tr><th>Student</th><th>Score</th><th>Feedback</th></tr></thead>
       <tbody>${roster
         .map(
           (r) => `<tr>
             <td>${escapeHtml(r.name)}</td>
             <td><input type="number" step="0.5" min="0" max="${assignment.max_score}" data-score="${r.student_id}" value="${r.score ?? ""}" style="width:90px"></td>
             <td><input data-fb="${r.student_id}" value="${escapeHtml(r.feedback || "")}"></td>
           </tr>`
         )
         .join("")}</tbody></table>
     </div>
     <div class="modal-actions" style="margin-top:16px">
       <button type="button" class="btn" data-close>Close</button>
       <button type="button" class="btn primary" id="saveGrades">Save grades</button>
     </div>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#saveGrades").addEventListener("click", async () => {
          const records = [...backdrop.querySelectorAll("[data-score]")].map((inp) => ({
            student_id: Number(inp.dataset.score),
            score: inp.value,
            feedback: backdrop.querySelector(`[data-fb="${inp.dataset.score}"]`)?.value || null,
          }));
          try {
            await api(`/grades/assignments/${assignmentId}/grades`, { method: "POST", body: { records } });
            toast("Grades saved");
            close();
            init();
          } catch (err) {
            toast(err.message, "error");
          }
        });
      },
    }
  );
}

/* ---------- Student / Parent ---------- */
async function studentView() {
  const students = await api("/students");
  if (!students.length) {
    content.innerHTML = `<div class="card empty">No student records linked to your account.</div>`;
    return;
  }
  content.innerHTML =
    `<div class="page-head"><div><h2>Grades</h2><p class="muted">Report of scores</p></div></div>
     <div class="card" style="margin-bottom:16px">
       <div class="field" style="max-width:320px"><label>Student</label>
         <select id="studentSel">${students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select></div>
     </div>
     <div id="hist"></div>`;
  const load = () => loadGrades(document.getElementById("studentSel").value);
  document.getElementById("studentSel").addEventListener("change", load);
  load();
}

async function loadGrades(studentId) {
  const el = document.getElementById("hist");
  el.innerHTML = `<div class="empty">Loading...</div>`;
  const { records, average_percent } = await api(`/grades/student/${studentId}`);
  el.innerHTML =
    `<div class="grid cols-3" style="margin-bottom:16px">
       <div class="card stat"><span class="label">Average</span><span class="value">${average_percent == null ? "-" : Math.round(average_percent) + "%"}</span></div>
       <div class="card stat"><span class="label">Assignments graded</span><span class="value">${records.length}</span></div>
     </div>` +
    (records.length
      ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Assignment</th><th>Class</th><th>Score</th><th>Percent</th><th>Due</th><th>Feedback</th></tr></thead>
          <tbody>${records
            .map(
              (r) => `<tr><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.class_name || "-")}</td>
                <td>${r.score == null ? "-" : r.score} / ${r.max_score}</td>
                <td>${r.score == null ? "-" : Math.round((r.score / r.max_score) * 100) + "%"}</td>
                <td>${fmtDate(r.due_date)}</td><td>${escapeHtml(r.feedback || "-")}</td></tr>`
            )
            .join("")}</tbody></table></div></div>`
      : `<div class="card empty">No grades yet.</div>`);
}

init().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
