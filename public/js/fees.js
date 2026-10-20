import { api, requireLogin, renderShell, escapeHtml, money, fmtDate, statusBadge, toast, openModal } from "./common.js";

const user = requireLogin();
const isAdmin = user.role === "admin";
const isStaff = user.role === "admin" || user.role === "teacher";
renderShell("fees.html", "Fees");
const content = document.getElementById("content");

async function init() {
  const [fees, students] = await Promise.all([
    api("/fees"),
    isAdmin ? api("/students") : Promise.resolve([]),
  ]);

  const paid = fees.filter((f) => f.status === "paid").reduce((a, f) => a + f.amount, 0);
  const pending = fees.filter((f) => f.status === "pending").reduce((a, f) => a + f.amount, 0);
  const overdue = fees.filter((f) => f.status === "overdue").reduce((a, f) => a + f.amount, 0);

  content.innerHTML =
    `<div class="page-head">
       <div><h2>Fees &amp; Billing</h2><p class="muted">${fees.length} record(s)</p></div>
       ${isAdmin ? `<button class="btn primary" id="addBtn">+ Add fee</button>` : ""}
     </div>
     <div class="grid cols-3" style="margin-bottom:16px">
       <div class="card stat"><span class="label">Collected</span><span class="value">${money(paid)}</span></div>
       <div class="card stat"><span class="label">Pending</span><span class="value">${money(pending)}</span></div>
       <div class="card stat"><span class="label">Overdue</span><span class="value">${money(overdue)}</span></div>
     </div>` +
    (fees.length
      ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th>Paid</th>${isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody>${fees
            .map(
              (f) => `<tr>
                <td>${f.student ? escapeHtml(f.student.name) : "-"}</td>
                <td>${escapeHtml(f.description)}</td>
                <td>${money(f.amount)}</td>
                <td>${fmtDate(f.due_date)}</td>
                <td>${statusBadge(f.status)}</td>
                <td>${f.paid_date ? fmtDate(f.paid_date) + (f.method ? " (" + escapeHtml(f.method) + ")" : "") : "-"}</td>
                ${
                  isAdmin
                    ? `<td style="white-space:nowrap">
                        ${f.status !== "paid" ? `<button class="btn sm primary" data-pay="${f.id}">Mark paid</button>` : ""}
                        <button class="btn sm" data-edit="${f.id}">Edit</button>
                        <button class="btn sm danger" data-del="${f.id}">Delete</button>
                      </td>`
                    : ""
                }
              </tr>`
            )
            .join("")}</tbody></table></div></div>`
      : `<div class="card empty">No fee records.</div>`);

  if (isAdmin) {
    document.getElementById("addBtn").addEventListener("click", () => feeForm(null, students, init));
    content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => feeForm(fees.find((f) => f.id == b.dataset.edit), students, init)));
    content.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => removeFee(b.dataset.del)));
    content.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => markPaid(b.dataset.pay)));
  }
}

function studentOptions(students, selected) {
  return students
    .map((s) => `<option value="${s.id}" ${Number(selected) === s.id ? "selected" : ""}>${escapeHtml(s.name)}${s.roll_no ? " (" + escapeHtml(s.roll_no) + ")" : ""}</option>`)
    .join("");
}

function feeForm(f, students, done) {
  openModal(
    `<h3>${f ? "Edit" : "Add"} fee record</h3>
     <form id="fForm">
       <div class="field"><label>Student *</label><select name="student_id" ${f ? "disabled" : ""}>${studentOptions(students, f?.student_id)}</select></div>
       <div class="field"><label>Description *</label><input name="description" value="${escapeHtml(f?.description || "")}" required></div>
       <div class="form-row">
         <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0" value="${f?.amount ?? ""}"></div>
         <div class="field"><label>Due date</label><input name="due_date" type="date" value="${f?.due_date || ""}"></div>
       </div>
       <div class="field"><label>Status</label><select name="status">${["pending", "paid", "overdue"].map((s) => `<option value="${s}" ${f?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#fForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          body.amount = Number(body.amount) || 0;
          if (f) delete body.student_id;
          else body.student_id = Number(body.student_id);
          try {
            if (f) await api(`/fees/${f.id}`, { method: "PUT", body });
            else await api("/fees", { method: "POST", body });
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

async function markPaid(id) {
  try {
    await api(`/fees/${id}/pay`, { method: "POST", body: { method: "Cash" } });
    toast("Marked as paid");
    init();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function removeFee(id) {
  if (!confirm("Delete this fee record?")) return;
  try {
    await api(`/fees/${id}`, { method: "DELETE" });
    toast("Deleted");
    init();
  } catch (err) {
    toast(err.message, "error");
  }
}

init().catch((e) => (content.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`));
