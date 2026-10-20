import { api, requireLogin, renderShell, escapeHtml, openModal, toast } from "./common.js";

const user = requireLogin("admin", "teacher");
renderShell("teachers.html", "Teachers");
const content = document.getElementById("content");
const canEdit = user.role === "admin";

async function load() {
  const teachers = await api("/teachers");
  document.title = "Teachers - EduManage";
  content.innerHTML =
    `<div class="page-head">
       <div><h2>Teachers</h2><p class="muted">${teachers.length} record(s)</p></div>
       ${canEdit ? `<button class="btn primary" id="addBtn">+ Add teacher</button>` : ""}
     </div>` +
    (teachers.length
      ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Subject</th><th>Email</th><th>Phone</th>${canEdit ? "<th></th>" : ""}</tr></thead>
          <tbody>${teachers
            .map(
              (t) => `<tr><td><strong>${escapeHtml(t.name)}</strong></td><td>${escapeHtml(t.subject || "-")}</td>
                <td>${escapeHtml(t.email || "-")}</td><td>${escapeHtml(t.phone || "-")}</td>
                ${canEdit ? `<td style="white-space:nowrap"><button class="btn sm" data-edit="${t.id}">Edit</button> <button class="btn sm danger" data-del="${t.id}">Delete</button></td>` : ""}
              </tr>`
            )
            .join("")}</tbody></table></div></div>`
      : `<div class="card empty">No teachers found.</div>`);

  if (canEdit) {
    document.getElementById("addBtn").addEventListener("click", () => form());
    content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => form(teachers.find((t) => t.id == b.dataset.edit))));
    content.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => remove(b.dataset.del)));
  }
}

function form(t = {}) {
  openModal(
    `<h3>${t.id ? "Edit" : "Add"} teacher</h3>
     <form id="tForm">
       <div class="field"><label>Full name *</label><input name="name" value="${escapeHtml(t.name || "")}" required></div>
       <div class="form-row">
         <div class="field"><label>Subject</label><input name="subject" value="${escapeHtml(t.subject || "")}"></div>
         <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(t.phone || "")}"></div>
       </div>
       <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(t.email || "")}"></div>
       ${!t.id ? `<div class="field"><label><input type="checkbox" name="create_login" style="width:auto;margin-right:8px" checked>Create a teacher login (default password: teacher123)</label></div>` : ""}
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#tForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          body.create_login = !!fd.get("create_login");
          try {
            if (t.id) await api(`/teachers/${t.id}`, { method: "PUT", body });
            else await api("/teachers", { method: "POST", body });
            toast("Teacher saved");
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

async function remove(id) {
  if (!confirm("Delete this teacher?")) return;
  try {
    await api(`/teachers/${id}`, { method: "DELETE" });
    toast("Teacher deleted");
    load();
  } catch (err) {
    toast(err.message, "error");
  }
}

load().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
