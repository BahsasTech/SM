const TOKEN_KEY = "sms_token";
const USER_KEY = "sms_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function logout() {
  clearSession();
  window.location.href = "index.html";
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Run 'npm start' and open http://localhost:3000");
  }
  if (res.status === 401) {
    clearSession();
    window.location.href = "index.html";
    throw new Error("Session expired");
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw new Error((data && data.error) || "Request failed");
  return data;
}

export function requireLogin(...allowedRoles) {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = "index.html";
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = "dashboard.html";
    return null;
  }
  return user;
}

const NAV = {
  admin: [
    ["dashboard.html", "Dashboard", "&#9632;"],
    ["students.html", "Students", "&#128100;"],
    ["teachers.html", "Teachers", "&#127979;"],
    ["classes.html", "Classes", "&#128218;"],
    ["attendance.html", "Attendance", "&#128197;"],
    ["grades.html", "Grades", "&#9999;"],
    ["fees.html", "Fees", "&#128176;"],
    ["reports.html", "Reports", "&#128202;"],
  ],
  teacher: [
    ["dashboard.html", "Dashboard", "&#9632;"],
    ["students.html", "Students", "&#128100;"],
    ["classes.html", "Classes", "&#128218;"],
    ["attendance.html", "Attendance", "&#128197;"],
    ["grades.html", "Grades", "&#9999;"],
  ],
  student: [
    ["dashboard.html", "Dashboard", "&#9632;"],
    ["grades.html", "My Grades", "&#9999;"],
    ["attendance.html", "My Attendance", "&#128197;"],
    ["fees.html", "My Fees", "&#128176;"],
  ],
  parent: [
    ["dashboard.html", "Dashboard", "&#9632;"],
    ["students.html", "My Children", "&#128100;"],
    ["grades.html", "Grades", "&#9999;"],
    ["attendance.html", "Attendance", "&#128197;"],
    ["fees.html", "Fees", "&#128176;"],
  ],
};

export function renderShell(activePage, title) {
  const user = getUser();
  const links = NAV[user.role] || NAV.student;
  const navHtml = links
    .map(
      ([href, label, ic]) =>
        `<a href="${href}" class="${href === activePage ? "active" : ""}"><span class="ic">${ic}</span>${label}</a>`
    )
    .join("");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand"><span class="logo">&#127891;</span><span>EduManage</span></div>
      <nav class="nav">${navHtml}</nav>
      <div class="foot"><a href="#" id="logoutLink"><span class="ic">&#10162;</span>Sign out</a></div>`;
    document.getElementById("logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  const topbar = document.getElementById("topbar");
  if (topbar) {
    const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    topbar.innerHTML = `
      <div><h2>${title || ""}</h2></div>
      <div class="who">
        <span class="badge role">${user.role}</span>
        <span class="muted">${escapeHtml(user.name)}</span>
        <span class="avatar">${initials}</span>
        <button class="btn sm" id="pwBtn">Password</button>
      </div>`;
    document.getElementById("pwBtn").addEventListener("click", changePasswordModal);
  }
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function money(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
export function statusBadge(status) {
  if (!status) return '<span class="muted">-</span>';
  return `<span class="badge ${status}">${status}</span>`;
}

export function toast(message, type = "ok") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast ${type === "error" ? "error" : ""} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

export function openModal(innerHtml, { onMount } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal">${innerHtml}</div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  if (onMount) onMount(backdrop, close);
  return { el: backdrop, close };
}

async function changePasswordModal() {
  openModal(
    `<h3>Change password</h3>
     <form id="pwForm">
       <div class="field"><label>Current password</label><input type="password" name="currentPassword" required></div>
       <div class="field"><label>New password</label><input type="password" name="newPassword" required minlength="6"></div>
       <div class="modal-actions">
         <button type="button" class="btn" data-close>Cancel</button>
         <button type="submit" class="btn primary">Update</button>
       </div>
     </form>`,
    {
      onMount(backdrop, close) {
        backdrop.querySelector("[data-close]").addEventListener("click", close);
        backdrop.querySelector("#pwForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api("/auth/change-password", {
              method: "POST",
              body: {
                currentPassword: fd.get("currentPassword"),
                newPassword: fd.get("newPassword"),
              },
            });
            toast("Password updated");
            close();
          } catch (err) {
            toast(err.message, "error");
          }
        });
      },
    }
  );
}
