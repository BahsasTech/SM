import { api, requireLogin, renderShell, escapeHtml, openModal, toast } from "./common.js";

const user = requireLogin("admin", "teacher");
renderShell("classes.html", "Classes");
const content = document.getElementById("content");
const canEdit = user.role === "admin";
let teachers = [];

async function load() {
  const classes = await api("/classes");
  if (canEdit) teachers = await api("/teachers");

  content.innerHTML =
    `<div class="page-head">
       <div><h2>Classes</h2><p class="muted">${classes.length} class(es)</p></div>
       ${canEdit ? `<button class="btn primary" id="addBtn">+ Add class</button>` : ""}
     </div>` +
    (classes.length
      ? `<div class="grid cols-3">${classes
          .map(
            (c) => `<div class="card">
              <div style="display:flex;justify-content:space-between;align-items:start">
                <div><h3 style="margin-bottom:4px">${escapeHtml(c.name)}</h3>
                <span class="badge role">${escapeHtml(c.code)}</span></div>
                ${canEdit ? `<div><button class="btn sm" data-edit="${c.id}">Edit</button></div>` : ""}
              </div>
              <p class="muted" style="margin:14px 0 6px"><strong>Teacher:</strong> ${c.teacher ? escapeHtml(c.teacher.name) : "Unassigned"}</p>
              <p class="muted" style="margin:0 0 6px"><strong>Room:</strong> ${escapeHtml(c.room || "-")}</p>
              <p class="muted" style="margin:0 0 6px"><strong>Schedule:</strong> ${escapeHtml(c.schedule || "-")}</p>
              <p class="muted" style="margin:0 0 14px"><strong>Students:</strong> ${c.student_count} / ${c.capacity}</p>
              ${canEdit ? `<button class="btn sm danger" data-del="${c.id}">Delete</button>` : ""}
            </div>`
          )
          .join("")}</div>`
      : `<div class="card empty">No classes yet.</div>`);

  if (canEdit) {
    document.getElementById("addBtn").addEventListener("click", () => form());
    content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => form(classes.find((c) => c.id == b.dataset.edit))));
    content.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => remove(b.dataset.del)));
  }
}

function teacherOptions(selected) {
  return `<option value="">Unassigned</option>` +
    teachers.map((t) => `<option value="${t.id}" ${Number(selected) === t.id ? "selected" : ""}>${escapeHtml(t.name)}${t.subject ? " - " + escapeHtml(t.subject) : ""}</option>`).join("");
}

function form(c = {}) {
  openModal(
    `<h3>${c.id ? "Edit" : "Add"} class</h3>
     <form id="cForm">
       <div class="form-row">
         <div class="field"><label>Class name *</label><input name="name" value="${escapeHtml(c.name || "")}" required></div>
         <div class="field"><label>Code *</label><input name="code" value="${escapeHtml(c.code || "")}" required></div>
       </div>
       <div class="form-row">
         <div class="field"><label>Room</label><input name="room" value="${escapeHtml(c.room || "")}"></div>
         <div class="field"><label>Capacity</label><input name="capacity" type="number" min="1" value="${c.capacity || 40}"></div>
       </div>
       <div class="field"><label>Schedule</label><input name="schedule" placeholder="Mon/Wed/Fri 08:00-09:00" value="${escapeHtml(c.schedule || "")}"></div>
       <div class="field"><label>Teacher</label><select name="teacher_id">${teacherOptions(c.teacher_id)}</select></div>
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#cForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          body.capacity = Number(body.capacity) || 40;
          body.teacher_id = body.teacher_id ? Number(body.teacher_id) : null;
          try {
            if (c.id) await api(`/classes/${c.id}`, { method: "PUT", body });
            else await api("/classes", { method: "POST", body });
            toast("Class saved");
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
  if (!confirm("Delete this class?")) return;
  try {
    await api(`/classes/${id}`, { method: "DELETE" });
    toast("Class deleted");
    load();
  } catch (err) {
    toast(err.message, "error");
  }
}

load().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
