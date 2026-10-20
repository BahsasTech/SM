import { api, requireLogin, renderShell, escapeHtml, openModal, toast } from "./common.js";

const user = requireLogin();
renderShell("students.html", user.role === "parent" ? "My Children" : "Students");
const content = document.getElementById("content");
const canEdit = user.role === "admin";

let classes = [];

async function init() {
  if (user.role === "admin" || user.role === "teacher") {
    classes = await api("/classes");
  }
  await load();
}

function classOptions(selected) {
  return `<option value="">Unassigned</option>` +
    classes.map((c) => `<option value="${c.id}" ${Number(selected) === c.id ? "selected" : ""}>${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join("");
}

export async function load() {
  const students = await api("/students");
  render(students);
}

function render(students) {
  const head = `<div class="page-head">
      <div><h2>${user.role === "parent" ? "My Children" : "Students"}</h2>
      <p class="muted">${students.length} record(s)</p></div>
      ${canEdit ? `<button class="btn primary" id="addBtn">+ Add student</button>` : ""}
    </div>`;

  if (!students.length) {
    content.innerHTML = head + `<div class="card empty">No students found.</div>`;
  } else {
    content.innerHTML = head + `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Email</th><th>Guardian</th><th>Guardian phone</th>${canEdit ? "<th></th>" : ""}</tr></thead>
      <tbody>${students.map(row).join("")}</tbody></table></div></div>`;
  }

  if (canEdit) {
    document.getElementById("addBtn").addEventListener("click", () => studentForm());
    content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => studentForm(students.find((s) => s.id == b.dataset.edit))));
    content.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => removeStudent(b.dataset.del)));
  }
}

function row(s) {
  return `<tr>
    <td>${escapeHtml(s.roll_no || "-")}</td>
    <td><strong>${escapeHtml(s.name)}</strong></td>
    <td>${s.class ? escapeHtml(s.class.name) : '<span class="muted">Unassigned</span>'}</td>
    <td>${escapeHtml(s.email || "-")}</td>
    <td>${escapeHtml(s.guardian_name || "-")}</td>
    <td>${escapeHtml(s.guardian_phone || "-")}</td>
    ${canEdit ? `<td style="white-space:nowrap"><button class="btn sm" data-edit="${s.id}">Edit</button> <button class="btn sm danger" data-del="${s.id}">Delete</button></td>` : ""}
  </tr>`;
}

function studentForm(s = {}) {
  openModal(
    `<h3>${s.id ? "Edit" : "Add"} student</h3>
     <form id="sForm">
       <div class="form-row">
         <div class="field"><label>Full name *</label><input name="name" value="${escapeHtml(s.name || "")}" required></div>
         <div class="field"><label>Roll no</label><input name="roll_no" value="${escapeHtml(s.roll_no || "")}"></div>
       </div>
       <div class="form-row">
         <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(s.email || "")}"></div>
         <div class="field"><label>Class</label><select name="class_id">${classOptions(s.class_id)}</select></div>
       </div>
       <div class="form-row">
         <div class="field"><label>Guardian name</label><input name="guardian_name" value="${escapeHtml(s.guardian_name || "")}"></div>
         <div class="field"><label>Guardian phone</label><input name="guardian_phone" value="${escapeHtml(s.guardian_phone || "")}"></div>
       </div>
       <div class="field"><label>Guardian email (linked for parent login)</label><input name="guardian_email" type="email" value="${escapeHtml(s.guardian_email || "")}"></div>
       ${!s.id ? `<div class="field"><label><input type="checkbox" name="create_login" style="width:auto;margin-right:8px" checked>Create a student login (default password: student123)</label></div>` : ""}
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#sForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          body.create_login = !!fd.get("create_login");
          body.class_id = body.class_id ? Number(body.class_id) : null;
          try {
            if (s.id) await api(`/students/${s.id}`, { method: "PUT", body });
            else await api("/students", { method: "POST", body });
            toast("Student saved");
            close();
            load();
          } catch (err) {
            toast(err.message, "error");
          }
        });
      },
    }
  );
}

async function removeStudent(id) {
  if (!confirm("Delete this student and all related records?")) return;
  try {
    await api(`/students/${id}`, { method: "DELETE" });
    toast("Student deleted");
    load();
  } catch (err) {
    toast(err.message, "error");
  }
}

init().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
