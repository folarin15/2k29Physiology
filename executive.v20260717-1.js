// ============================================================
// PhysioK29 — Executive Portal Module (Admin & Rep)
// Loaded ONLY on K29.admin/ and K29.rep/ pages
// ============================================================
import { firstSemesterCourses, secondSemesterCourses } from "./data.v20260717-1.js";

/* ── BRIDGE: Shared functions from app.js ─────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(value) {
  if (value == null) return "";
  const d = document.createElement("div");
  d.textContent = String(value);
  return d.innerHTML;
}

function setMetricText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function showToast(msg, tone) {
  let t = $("#portalToast");
  if (!t) { t = document.createElement("div"); t.id = "portalToast"; t.className = "portal-toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.dataset.tone = tone || "default";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4200);
}

function toMillis(v) { return v ? new Date(v).getTime() || 0 : 0; }
function formatDate(ms) { return ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function formatDateTime(ms) { return ms ? new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

/* ── STATE BRIDGE ─────────────────────────────────────────── */
const _state = window.__PHYSIOK29_STATE__ || {};
function getState() { return window.__PHYSIOK29_STATE__ || {}; }

/* ── HELPERS ──────────────────────────────────────────────── */
function isAdminPortal() { return document.body.dataset.portalRole === "admin"; }
function isStaffPage() { return document.body.dataset.portal === "staff"; }

function getMemberStreak(memberId) {
  const s = getState();
  const events = (s.studyEvents || []).filter((e) => e.memberId === memberId);
  const dayKeys = new Set(events.map((e) => new Date(e.createdAtMs).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dayKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function summarizeMemberStudy(memberId) {
  const s = getState();
  const attempts = (s.quizAttempts || []).filter((a) => a.memberId === memberId);
  const events = (s.studyEvents || []).filter((e) => e.memberId === memberId);
  return {
    attemptCount: attempts.length,
    quizCount: attempts.filter((a) => a.mode === "practice").length,
    examCount: attempts.filter((a) => a.mode === "exam").length,
    totalQuestions: attempts.reduce((sum, a) => sum + Number(a.questionCount || 0), 0),
    totalScore: attempts.reduce((sum, a) => sum + Number(a.score || 0), 0),
    avgPercent: attempts.length ? Math.round((attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / Math.max(1, attempts.reduce((sum, a) => sum + Number(a.questionCount || 0), 0))) * 100) : 0,
    studyEventCount: events.length,
    lastActive: events.length ? Math.max(...events.map((e) => e.createdAtMs)) : 0,
  };
}

function getResourceProgress(resource) {
  const s = getState();
  return (s.resourceProgress || []).find((p) => p.resourceId === resource.id) || null;
}

function getResourceFeedback(resource) {
  const s = getState();
  return (s.resourceFeedback || []).find((f) => f.resourceId === resource.id) || null;
}

/* ── STAFF AUTH ───────────────────────────────────────────── */
function connectStaffPortal(allowedRoles) {
  const loginPanel = $("#staffLoginPanel");
  const staffPortal = $("#staffPortal");
  const signOutBtn = $("#staffSignOut");
  const diagnostic = $("#staffDiagnostic");
  if (!staffPortal) return;

  if (!loginPanel) {
    staffPortal.hidden = false;
    return;
  }

  const backend = window.__PHYSIOK29_BACKEND__;
  if (!backend) return;

  let authUnsub = () => {};
  authUnsub = backend.onAuth(async (user, role) => {
    window.__PHYSIOK29_USER__ = user;
    window.__PHYSIOK29_ROLE__ = role;

    if (diagnostic) {
      diagnostic.textContent = user ? `Signed in as ${role?.displayName || user.email} (${role?.role || "unknown"})` : "Not signed in";
    }

    if (user && role && allowedRoles.includes(role.role)) {
      loginPanel.hidden = true;
      staffPortal.hidden = false;
      renderStaffPortal();
    } else {
      loginPanel.hidden = false;
      staffPortal.hidden = true;
    }
  });

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try { await backend.signOutRep(); } catch {}
      authUnsub();
    });
  }
}

/* ── RENDER: Members Table ────────────────────────────────── */
function renderMembersTable() {
  const tbody = $("#membersTableBody");
  if (!tbody) return;

  const s = getState();
  const members = s.members || [];
  tbody.innerHTML = members.length
    ? members.map((m) => {
        const streak = getMemberStreak(m.id);
        return `
          <tr>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.matricNumber)}</td>
            <td>${m.notificationEnabled ? "On" : "Off"}</td>
            <td>${streak}d</td>
            <td>${formatDate(m.lastSeenAtMs || m.createdAtMs)}</td>
            ${isAdminPortal() ? `<td><button class="ghost-action danger-link" data-delete-member="${m.id}">Delete</button></td>` : ""}
          </tr>`;
      }).join("")
    : '<tr><td colspan="6">No members yet.</td></tr>';

  tbody.querySelectorAll("[data-delete-member]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMember(btn.dataset.deleteMember));
  });
}

async function deleteMember(memberId) {
  if (!confirm("Delete this member and all their data?")) return;
  try {
    const backend = window.__PHYSIOK29_BACKEND__;
    await backend.deleteMember(memberId);
    showToast("Member deleted.");
  } catch (e) { showToast(e.message || "Delete failed.", "error"); }
}

/* ── RENDER: Staff Lists (Resources, Announcements, Suggestions) ── */
function renderStaffLists() {
  renderStaffResources();
  renderStaffAnnouncements();
  renderStaffSuggestions();
}

function renderStaffResources() {
  const tbody = $("#staffResourcesBody");
  if (!tbody) return;
  const s = getState();
  const resources = s.resources || [];
  const user = window.__PHYSIOK29_USER__;
  tbody.innerHTML = resources.length
    ? resources.map((r) => {
        const isOwner = user && r.uploadedByUid === user.id;
        return `
          <tr>
            <td>${escapeHtml(r.title)}</td>
            <td>${escapeHtml(r.courseCode)}</td>
            <td>${escapeHtml(r.type)}</td>
            <td>${formatDate(r.createdAtMs)}</td>
            <td>
              ${isOwner ? `<button class="ghost-action" data-edit-resource="${r.id}">Edit</button>` : ""}
              ${isOwner ? `<button class="ghost-action danger-link" data-delete-resource="${r.id}">Delete</button>` : ""}
            </td>
          </tr>`;
      }).join("")
    : '<tr><td colspan="5">No resources uploaded yet.</td></tr>';

  tbody.querySelectorAll("[data-edit-resource]").forEach((btn) => {
    btn.addEventListener("click", () => openEditResourceModal(btn.dataset.editResource));
  });
  tbody.querySelectorAll("[data-delete-resource]").forEach((btn) => {
    btn.addEventListener("click", () => deleteResource(btn.dataset.deleteResource));
  });
}

function renderStaffAnnouncements() {
  const tbody = $("#staffAnnouncementsBody");
  if (!tbody) return;
  const s = getState();
  const announcements = s.announcements || [];
  const user = window.__PHYSIOK29_USER__;
  tbody.innerHTML = announcements.length
    ? announcements.map((a) => {
        const isOwner = user && a.postedByUid === user.id;
        return `
          <tr>
            <td>${escapeHtml(a.title)}</td>
            <td><span class="priority-pill" data-priority="${escapeHtml(a.priority)}">${escapeHtml(a.priority)}</span></td>
            <td>${escapeHtml(a.postedBy)}</td>
            <td>${formatDate(a.createdAtMs)}</td>
            <td>
              ${isOwner ? `<button class="ghost-action" data-edit-announcement="${a.id}">Edit</button>` : ""}
              ${isOwner ? `<button class="ghost-action danger-link" data-delete-announcement="${a.id}">Delete</button>` : ""}
            </td>
          </tr>`;
      }).join("")
    : '<tr><td colspan="5">No announcements yet.</td></tr>';

  tbody.querySelectorAll("[data-edit-announcement]").forEach((btn) => {
    btn.addEventListener("click", () => openEditAnnouncementModal(btn.dataset.editAnnouncement));
  });
  tbody.querySelectorAll("[data-delete-announcement]").forEach((btn) => {
    btn.addEventListener("click", () => deleteAnnouncement(btn.dataset.deleteAnnouncement));
  });
}

function renderStaffSuggestions() {
  const tbody = $("#staffSuggestionsBody");
  if (!tbody) return;
  const s = getState();
  const suggestions = s.suggestions || [];
  tbody.innerHTML = suggestions.length
    ? suggestions.map((sg) => `
        <tr>
          <td>${escapeHtml(sg.name)}</td>
          <td>${escapeHtml(sg.matricNumber)}</td>
          <td>${escapeHtml(sg.category)}</td>
          <td>${escapeHtml(sg.message?.slice(0, 60))}${(sg.message?.length || 0) > 60 ? "…" : ""}</td>
          <td>${formatDate(sg.createdAtMs)}</td>
          <td>
            <button class="ghost-action" data-view-suggestion="${sg.id}">View</button>
            ${isAdminPortal() ? `<button class="ghost-action danger-link" data-delete-suggestion="${sg.id}">Delete</button>` : ""}
          </td>
        </tr>`).join("")
    : '<tr><td colspan="6">No suggestions yet.</td></tr>';

  tbody.querySelectorAll("[data-view-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => openSuggestionModal(btn.dataset.viewSuggestion));
  });
  tbody.querySelectorAll("[data-delete-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSuggestion(btn.dataset.deleteSuggestion));
  });
}

/* ── MODALS: Edit Resource, Edit Announcement, View Suggestion ── */
function openEditResourceModal(resourceId) {
  const s = getState();
  const resource = s.resources?.find((r) => r.id === resourceId);
  if (!resource) return showToast("Resource not found.", "error");
  showFormModal("Edit Resource", [
    { label: "Title", type: "text", id: "editResourceTitle", value: resource.title },
    { label: "Type", type: "select", id: "editResourceType", value: resource.type, options: ["Resource", "Weekly Lecture", "Revision Material", "Practical Manual", "Test Material", "Lab Report", "Mid-Semester", "Assignment"] },
    { label: "Note", type: "textarea", id: "editResourceNote", value: resource.note || "" },
  ], async () => {
    const title = $("#editResourceTitle")?.value?.trim();
    const type = $("#editResourceType")?.value;
    const note = $("#editResourceNote")?.value?.trim();
    if (!title) return showToast("Title is required.", "error");
    const backend = window.__PHYSIOK29_BACKEND__;
    await backend.updateResource(resourceId, { title, type, note, fileName: resource.fileName });
    showToast("Resource updated.");
  });
}

function openEditAnnouncementModal(announcementId) {
  const s = getState();
  const ann = s.announcements?.find((a) => a.id === announcementId);
  if (!ann) return showToast("Announcement not found.", "error");
  showFormModal("Edit Announcement", [
    { label: "Title", type: "text", id: "editAnnouncementTitle", value: ann.title },
    { label: "Priority", type: "select", id: "editAnnouncementPriority", value: ann.priority, options: ["Normal", "Important", "Urgent"] },
    { label: "Message", type: "textarea", id: "editAnnouncementMessage", value: ann.message },
  ], async () => {
    const title = $("#editAnnouncementTitle")?.value?.trim();
    const priority = $("#editAnnouncementPriority")?.value;
    const message = $("#editAnnouncementMessage")?.value?.trim();
    if (!title || !message) return showToast("Title and message are required.", "error");
    const backend = window.__PHYSIOK29_BACKEND__;
    await backend.updateAnnouncement(announcementId, { title, priority, message });
    showToast("Announcement updated.");
  });
}

function openSuggestionModal(suggestionId) {
  const s = getState();
  const sg = s.suggestions?.find((x) => x.id === suggestionId);
  if (!sg) return showToast("Suggestion not found.", "error");
  if ($("#suggestionDetailModal")) return;
  const overlay = document.createElement("section");
  overlay.id = "suggestionDetailModal";
  overlay.className = "edit-modal";
  overlay.innerHTML = `
    <article class="edit-card">
      <header><div><p class="eyebrow">Suggestion</p><h2>${escapeHtml(sg.category)}</h2></div>
        <button type="button" class="icon-button" data-close-edit><span class="material-symbols-rounded">close</span></button></header>
      <p><strong>${escapeHtml(sg.name)}</strong> · ${escapeHtml(sg.matricNumber)}</p>
      <p>${formatDateTime(sg.createdAtMs)}</p>
      <hr>
      <p>${escapeHtml(sg.message)}</p>
    </article>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close-edit]")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function showFormModal(title, fields, onSave) {
  if ($("#execFormModal")) return;
  const overlay = document.createElement("section");
  overlay.id = "execFormModal";
  overlay.className = "edit-modal";
  overlay.innerHTML = `
    <article class="edit-card">
      <header><div><p class="eyebrow">Edit</p><h2>${escapeHtml(title)}</h2></div>
        <button type="button" class="icon-button" data-close-edit><span class="material-symbols-rounded">close</span></button></header>
      <form id="execForm">
        ${fields.map((f) => {
          if (f.type === "select") {
            return `<label>${escapeHtml(f.label)}<select id="${f.id}">${f.options.map((o) => `<option value="${o}"${o === f.value ? " selected" : ""}>${o}</option>`).join("")}</select></label>`;
          }
          if (f.type === "textarea") {
            return `<label>${escapeHtml(f.label)}<textarea id="${f.id}" rows="4">${escapeHtml(f.value || "")}</textarea></label>`;
          }
          return `<label>${escapeHtml(f.label)}<input type="text" id="${f.id}" value="${escapeHtml(f.value || "")}" /></label>`;
        }).join("")}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" class="secondary-action" data-close-edit>Cancel</button>
          <button type="submit" class="primary-action">Save</button>
        </div>
      </form>
    </article>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll("[data-close-edit]").forEach((b) => b.addEventListener("click", () => overlay.remove()));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#execForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await onSave();
      overlay.remove();
    } catch (err) { showToast(err.message || "Save failed.", "error"); }
  });
}

/* ── RESOURCE / ANNOUNCEMENT / SUGGESTION DELETE ──────────── */
async function deleteResource(resourceId) {
  if (!confirm("Delete this resource?")) return;
  try {
    const s = getState();
    const resource = s.resources?.find((r) => r.id === resourceId);
    const backend = window.__PHYSIOK29_BACKEND__;
    if (resource) await backend.deleteResource(resource);
    showToast("Resource deleted.");
  } catch (e) { showToast(e.message || "Delete failed.", "error"); }
}

async function deleteAnnouncement(announcementId) {
  if (!confirm("Delete this announcement?")) return;
  try {
    const backend = window.__PHYSIOK29_BACKEND__;
    await backend.deleteAnnouncement(announcementId);
    showToast("Announcement deleted.");
  } catch (e) { showToast(e.message || "Delete failed.", "error"); }
}

async function deleteSuggestion(suggestionId) {
  if (!confirm("Delete this suggestion?")) return;
  try {
    const backend = window.__PHYSIOK29_BACKEND__;
    await backend.deleteSuggestion(suggestionId);
    showToast("Suggestion deleted.");
  } catch (e) { showToast(e.message || "Delete failed.", "error"); }
}

/* ── RENDER: Staff Summary ────────────────────────────────── */
function renderStaffSummary() {
  const grid = $("#staffSummaryGrid");
  if (!grid) return;
  const s = getState();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const uploadsThisWeek = s.resources?.filter((r) => Number(r.createdAtMs || 0) >= weekAgo).length || 0;
  const pushOff = s.members?.filter((m) => !m.notificationEnabled).length || 0;
  const helpfulVotes = s.resourceFeedback?.filter((f) => f.helpful).length || 0;
  const activeStudyMembers = new Set((s.studyEvents || []).filter((e) => Date.now() - e.createdAtMs < 7 * 24 * 60 * 60 * 1000).map((e) => e.memberId)).size;
  const topStreak = (s.members || []).reduce((best, m) => Math.max(best, getMemberStreak(m.id)), 0);
  const courseOpens = new Map();
  (s.resourceProgress || []).forEach((p) => {
    const resource = (s.resources || []).find((r) => r.id === p.resourceId);
    if (resource?.courseCode) courseOpens.set(resource.courseCode, (courseOpens.get(resource.courseCode) || 0) + Number(p.openedCount || 0));
  });
  const mostOpened = [...courseOpens.entries()].sort((a, b) => b[1] - a[1])[0];
  grid.innerHTML = `
    <article class="metric-card staff-summary-card"><span>${uploadsThisWeek}</span><small>uploads this week</small></article>
    <article class="metric-card staff-summary-card"><span>${mostOpened ? escapeHtml(mostOpened[0]) : "None"}</span><small>${mostOpened ? `${mostOpened[1]} reader opens` : "most opened course"}</small></article>
    <article class="metric-card staff-summary-card"><span>${pushOff}</span><small>students with push off</small></article>
    <article class="metric-card staff-summary-card"><span>${helpfulVotes}</span><small>helpful resource votes</small></article>
    <article class="metric-card staff-summary-card"><span>${activeStudyMembers}</span><small>students active this week</small></article>
    <article class="metric-card staff-summary-card"><span>${topStreak}</span><small>top study streak</small></article>`;
}

/* ── RENDER: Admin Dashboard ──────────────────────────────── */
function renderAdminDashboard() {
  const greeting = $("#adminGreeting");
  const summaryGrid = $("#adminSummaryGrid");
  const cardGrid = $("#adminCardGrid");
  if (!$("#adminMetricRow")) return;

  if (greeting) {
    const hour = new Date().getHours();
    greeting.textContent = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  }

  const s = getState();
  const resources = s.resources || [];
  const members = s.members || [];
  const suggestions = s.suggestions || [];
  const announcements = s.announcements || [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const totalResources = resources.length;
  const totalMembers = members.length;
  const pendingSuggestions = suggestions.filter((sg) => sg.status === "pending").length;
  const uploadsThisWeek = resources.filter((r) => Number(r.createdAtMs || 0) >= weekAgo).length;
  const quizAttempts = s.quizAttempts || [];
  const studyEvents = s.studyEvents || [];
  const totalQuizzes = quizAttempts.filter((a) => a.mode === "practice").length;
  const totalExams = quizAttempts.filter((a) => a.mode === "exam").length;
  const totalQuestions = quizAttempts.reduce((sum, a) => sum + Number(a.questionCount || 0), 0);
  const totalScore = quizAttempts.reduce((sum, a) => sum + Number(a.score || 0), 0);
  const classAvg = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;
  const activeToday = new Set(studyEvents.filter((e) => e.createdAtMs >= Date.now() - 86400000).map((e) => e.memberId)).size;
  const activeWeek = new Set(studyEvents.filter((e) => e.createdAtMs >= weekAgo).map((e) => e.memberId)).size;
  const topStreak = members.reduce((best, m) => Math.max(best, getMemberStreak(m.id)), 0);
  const topStreakMember = members.find((m) => getMemberStreak(m.id) === topStreak);
  const totalStudyMinutes = Math.round(quizAttempts.reduce((sum, a) => sum + Number(a.durationSeconds || 0), 0) / 60);

  setMetricText("#adminMetricMembers", totalMembers);
  setMetricText("#adminMetricResources", totalResources);
  setMetricText("#adminMetricQuizzes", totalQuizzes + totalExams);
  setMetricText("#adminMetricStreak", topStreak + "d");
  setMetricText("#adminMetricActive", activeWeek);
  setMetricText("#adminMetricAnnouncements", announcements.length);

  renderWeeklyActivityChart();
  renderEngagementRing();

  if (summaryGrid) {
    summaryGrid.innerHTML = `
      <article class="metric-card"><span>${totalMembers}</span><small>Class members</small></article>
      <article class="metric-card"><span>${activeToday}</span><small>Active today</small></article>
      <article class="metric-card"><span>${activeWeek}</span><small>Active this week</small></article>
      <article class="metric-card"><span>${topStreak}d</span><small>${topStreakMember ? topStreakMember.name : "top streak"}</small></article>
      <article class="metric-card"><span>${totalQuizzes + totalExams}</span><small>Quiz + exam attempts</small></article>
      <article class="metric-card"><span>${classAvg}%</span><small>Class average</small></article>`;
  }

  const coursesWithResources = new Set(resources.map((r) => r.courseCode).filter(Boolean)).size;
  const recentUploads = resources.filter((r) => Number(r.createdAtMs || 0) > weekAgo).length;
  const newSuggestions = suggestions.filter((sg) => sg.createdAtMs > weekAgo).length;

  const streakBoard = members.map((m) => ({ member: m, streak: getMemberStreak(m.id) })).filter((e) => e.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 5);
  const quizBoard = members.map((m) => ({ member: m, summary: summarizeMemberStudy(m.id) })).filter((e) => e.summary.attemptCount > 0).sort((a, b) => b.summary.attemptCount - a.summary.attemptCount).slice(0, 5);

  if (cardGrid) {
    cardGrid.innerHTML = `
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">cloud_upload</span><h3>Upload</h3></div><div class="admin-card-body"><strong>${recentUploads}</strong> uploaded this week &middot; <strong>${totalResources}</strong> total</div><div class="admin-card-footer"><span class="admin-card-stat">${coursesWithResources} courses covered</span><a class="ghost-action compact-action" href="#staffUpload" data-staff-tab="staffUpload">View All</a></div></article>
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">group</span><h3>Members</h3></div><div class="admin-card-body"><strong>${totalMembers}</strong> registered &middot; <strong>${activeWeek}</strong> active this week</div><div class="admin-card-footer"><span class="admin-card-stat">${activeToday} online today</span><a class="ghost-action compact-action" href="#staffMembers" data-staff-tab="staffMembers">View All</a></div></article>
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">quiz</span><h3>Quiz & Exam</h3></div><div class="admin-card-body"><strong>${totalQuizzes}</strong> quiz &middot; <strong>${totalExams}</strong> exam &middot; <strong>${classAvg}%</strong> avg</div><div class="admin-card-footer"><span class="admin-card-stat">${totalStudyMinutes} min tracked</span><a class="ghost-action compact-action" href="#staffStudyAnalytics" data-staff-tab="staffStudyAnalytics">View All</a></div></article>
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">local_fire_department</span><h3>Streak Board</h3></div><div class="admin-card-body">${streakBoard.length ? streakBoard.map((e, i) => `<strong>${i + 1}.</strong> ${escapeHtml(e.member.name)} — ${e.streak}d`).join("<br>") : "No active streaks yet"}</div><div class="admin-card-footer"><span class="admin-card-stat">Top: ${topStreak} days</span><a class="ghost-action compact-action" href="#staffStudyAnalytics" data-staff-tab="staffStudyAnalytics">Full Board</a></div></article>
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">leaderboard</span><h3>Most Active Quiz Users</h3></div><div class="admin-card-body">${quizBoard.length ? quizBoard.map((e, i) => `<strong>${i + 1}.</strong> ${escapeHtml(e.member.name)} — ${e.summary.attemptCount} attempts`).join("<br>") : "No quiz attempts yet"}</div><div class="admin-card-footer"><span class="admin-card-stat">${totalQuizzes + totalExams} total attempts</span><a class="ghost-action compact-action" href="#staffStudyAnalytics" data-staff-tab="staffStudyAnalytics">View All</a></div></article>
    <article class="admin-card"><div class="admin-card-header"><span class="material-symbols-rounded">forum</span><h3>Suggestions</h3></div><div class="admin-card-body"><strong>${pendingSuggestions}</strong> pending &middot; <strong>${newSuggestions}</strong> new this week</div><div class="admin-card-footer"><span class="admin-card-stat">${suggestions.length} total</span><a class="ghost-action compact-action" href="#staffSuggestions" data-staff-tab="staffSuggestions">View All</a></div></article>`;
  }
}

/* ── CHARTS ───────────────────────────────────────────────── */
function renderWeeklyActivityChart() {
  const container = $("#weeklyActivityChart");
  if (!container) return;
  const s = getState();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = new Set((s.studyEvents || []).filter((e) => new Date(e.createdAtMs).toISOString().slice(0, 10) === key).map((e) => e.memberId)).size;
    days.push({ label: d.toLocaleDateString("en", { weekday: "short" }), value: count, key });
  }
  const max = Math.max(...days.map((d) => d.value), 1);
  container.innerHTML = days.map((d) =>
    `<div class="chart-bar" style="height:${Math.round((d.value / max) * 100)}%" data-day="${d.key}"><span class="chart-bar-label">${d.value}</span><span class="chart-bar-day">${d.label}</span></div>`
  ).join("");
}

function renderEngagementRing() {
  const container = $("#engagementRing");
  if (!container) return;
  const s = getState();
  const total = (s.resources || []).length || 1;
  const opened = (s.resourceProgress || []).length;
  const read = (s.resourceProgress || []).filter((p) => ["reading", "urgent", "done"].includes(p.status)).length;
  const done = (s.resourceProgress || []).filter((p) => p.status === "done").length;
  const pct = total > 0 ? Math.round((opened / total) * 100) : 0;
  const ring = container.querySelector("#engagementRingFill");
  if (ring) {
    const circumference = 2 * Math.PI * 14;
    ring.style.strokeDasharray = `${circumference}`;
    ring.style.strokeDashoffset = `${circumference - (pct / 100) * circumference}`;
  }
  const pctEl = container.querySelector("#engagementPercent");
  if (pctEl) pctEl.textContent = `${pct}%`;
  const activeEl = container.querySelector("#engagementActive");
  if (activeEl) activeEl.textContent = String(opened);
}

/* ── RENDER: Staff Monitor ────────────────────────────────── */
function renderStaffMonitor() {
  const grid = $("#staffMonitorGrid");
  const courseBody = $("#staffMonitorCourseBody");
  const feed = $("#staffMonitorFeed");
  if (!grid && !courseBody && !feed) return;

  const s = getState();
  const resources = s.resources || [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (grid) {
    const perCourse = {};
    resources.forEach((r) => {
      if (!perCourse[r.courseCode]) perCourse[r.courseCode] = { code: r.courseCode, count: 0, types: new Set() };
      perCourse[r.courseCode].count++;
      perCourse[r.courseCode].types.add(r.type);
    });
    const courseEntries = Object.values(perCourse).sort((a, b) => b.count - a.count);
    grid.innerHTML = courseEntries.slice(0, 6).map((c) => `
      <article class="metric-card"><span>${c.count}</span><small>${escapeHtml(c.code)}</small></article>`).join("");
  }

  if (courseBody) {
    const perCourse = {};
    resources.forEach((r) => {
      if (!perCourse[r.courseCode]) perCourse[r.courseCode] = { code: r.courseCode, count: 0, lastUpload: 0 };
      perCourse[r.courseCode].count++;
      perCourse[r.courseCode].lastUpload = Math.max(perCourse[r.courseCode].lastUpload, r.createdAtMs || 0);
    });
    const entries = Object.values(perCourse).sort((a, b) => b.count - a.count);
    courseBody.innerHTML = entries.map((c) => `
      <tr><td>${escapeHtml(c.code)}</td><td>${c.count}</td><td>${formatDate(c.lastUpload)}</td></tr>`).join("");
  }

  if (feed) {
    const recent = resources.filter((r => (r.createdAtMs || 0) >= weekAgo)).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 10);
    feed.innerHTML = recent.length
      ? recent.map((r) => `<div class="monitor-feed-item"><strong>${escapeHtml(r.title)}</strong> <span class="muted">${escapeHtml(r.courseCode)}</span> <small>${formatDate(r.createdAtMs)}</small></div>`).join("")
      : '<p class="muted">No uploads this week.</p>';
  }
}

/* ── RENDER: Study Analytics ──────────────────────────────── */
let _studyFilterMemberId = "";

function renderStaffStudyAnalytics() {
  const grid = $("#staffStudyAnalyticsGrid");
  const leaderboard = $("#staffStudyLeaderboardBody");
  if (!grid && !leaderboard) return;

  const s = getState();
  const attempts = s.quizAttempts || [];
  const members = s.members || [];
  const totalAttempts = attempts.length;
  const avgPercent = totalAttempts ? Math.round(attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / Math.max(1, attempts.reduce((sum, a) => sum + Number(a.questionCount || 0), 0)) * 100) : 0;
  const uniqueStudents = new Set(attempts.map((a) => a.memberId)).size;
  const avgDuration = totalAttempts ? Math.round(attempts.reduce((sum, a) => sum + Number(a.durationSeconds || 0), 0) / totalAttempts) : 0;

  if (grid) {
    grid.innerHTML = `
      <article class="metric-card"><span>${totalAttempts}</span><small>Total attempts</small></article>
      <article class="metric-card"><span>${avgPercent}%</span><small>Average score</small></article>
      <article class="metric-card"><span>${uniqueStudents}</span><small>Unique students</small></article>
      <article class="metric-card"><span>${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s</span><small>Avg duration</small></article>`;
  }

  if (leaderboard) {
    const board = members.map((m) => ({ member: m, summary: summarizeMemberStudy(m.id) })).filter((e) => e.summary.attemptCount > 0).sort((a, b) => b.summary.attemptCount - a.summary.attemptCount);
    leaderboard.innerHTML = board.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.member.name)}</td>
        <td>${escapeHtml(e.member.matricNumber)}</td>
        <td>${e.summary.attemptCount}</td>
        <td>${e.summary.avgPercent}%</td>
        <td>${getMemberStreak(e.member.id)}d</td>
        <td><button class="ghost-action" data-view-member-history="${e.member.id}">History</button></td>
      </tr>`).join("");
    leaderboard.querySelectorAll("[data-view-member-history]").forEach((btn) => {
      btn.addEventListener("click", () => renderMemberStudyHistory(btn.dataset.viewMemberHistory));
    });
  }
}

function renderMemberStudyHistory(memberId) {
  const panel = $("#memberStudyHistoryPanel");
  if (!panel) return;
  const s = getState();
  const member = (s.members || []).find((m) => m.id === memberId);
  const attempts = (s.quizAttempts || []).filter((a) => a.memberId === memberId).sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  const topics = (s.topicPerformance || []).filter((t) => t.memberId === memberId);

  const html = `
    <header><h3>${escapeHtml(member?.name || "Unknown")}</h3><button class="icon-button" data-close-history><span class="material-symbols-rounded">close</span></button></header>
    <p>${escapeHtml(member?.matricNumber || "")} · ${attempts.length} attempts · ${getMemberStreak(memberId)}d streak</p>
    ${topics.length ? `<h4>Topic Performance</h4><table><tr><th>Topic</th><th>Accuracy</th><th>Attempts</th></tr>${topics.map((t) => `<tr><td>${escapeHtml(t.topic)}</td><td>${t.accuracy}%</td><td>${t.attempts}</td></tr>`).join("")}</table>` : ""}
    ${attempts.length ? `<h4>Recent Attempts</h4>${attempts.slice(0, 10).map((a) => `<div style="padding:6px 0"><strong>${escapeHtml(a.courseCode)}</strong> · ${a.mode} · ${a.score}/${a.questionCount} (${a.percent}%) · ${formatDate(a.submittedAtMs)}</div>`).join("")}` : "<p>No attempts found.</p>"}
  `;
  panel.innerHTML = html;
  panel.querySelector("[data-close-history]")?.addEventListener("click", () => { panel.innerHTML = ""; });
}

/* ── RENDER: Rep Summary ──────────────────────────────────── */
function renderRepSummary() {
  const uploadsEl = $("#repMetricUploads");
  const postsEl = $("#repMetricPosts");
  const suggestionsEl = $("#repMetricSuggestions");
  if (!uploadsEl && !postsEl && !suggestionsEl) return;

  const user = window.__PHYSIOK29_USER__;
  const s = getState();
  const myResources = (s.resources || []).filter((r) => user && r.uploadedByUid === user.id).length;
  const myPosts = (s.announcements || []).filter((a) => user && a.postedByUid === user.id).length;
  const totalSuggestions = (s.suggestions || []).length;

  if (uploadsEl) uploadsEl.textContent = myResources;
  if (postsEl) postsEl.textContent = myPosts;
  if (suggestionsEl) suggestionsEl.textContent = totalSuggestions;
}

/* ── RENDER: Forms (Upload, Announcement, Bulk) ──────────── */
function connectRepForms() {
  connectUploadForm();
  connectAnnouncementForm();
}

function connectUploadForm() {
  const form = $("#resourceUploadForm");
  if (!form) return;
  const status = $("#uploadStatus");
  const fileInput = form.querySelector('[name="file"]');

  const courseSelect = form.querySelector('[name="courseCode"]');
  if (courseSelect && !courseSelect.options.length) {
    [...firstSemesterCourses, ...secondSemesterCourses].forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.code; opt.textContent = `${c.code} — ${c.title}`;
      courseSelect.appendChild(opt);
    });
  }

  fileInput?.addEventListener("change", findPossibleDuplicate);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.name) return showToast("Choose a file.", "error");

    try {
      if (status) status.textContent = "Uploading...";
      const backend = window.__PHYSIOK29_BACKEND__;
      const data = Object.fromEntries(fd);
      const result = await backend.uploadResource(data, file, (pct) => { if (status) status.textContent = `Uploading... ${pct}%`; });
      if (status) status.textContent = "";
      showToast("Resource uploaded.");
      form.reset();
    } catch (err) {
      if (status) status.textContent = "";
      showToast(err.message || "Upload failed.", "error");
    }
  });
}

let _duplicateTimeout = null;

function findPossibleDuplicate() {
  clearTimeout(_duplicateTimeout);
  _duplicateTimeout = setTimeout(() => {
    const form = $("#resourceUploadForm");
    if (!form) return;
    const fd = new FormData(form);
    const file = fd.get("file");
    const courseCode = fd.get("courseCode");
    if (!(file instanceof File) || !courseCode) return;
    const s = getState();
    const match = (s.resources || []).find((r) => r.courseCode === courseCode && r.fileName === file.name);
    const dupWarning = $("#duplicateWarning");
    if (match && dupWarning) dupWarning.hidden = false;
    else if (dupWarning) dupWarning.hidden = true;
  }, 500);
}

function connectAnnouncementForm() {
  const form = $("#announcementForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const backend = window.__PHYSIOK29_BACKEND__;
      await backend.postAnnouncement(Object.fromEntries(fd));
      showToast("Announcement posted.");
      form.reset();
    } catch (err) {
      showToast(err.message || "Post failed.", "error");
    }
  });
}

/* ── BULK UPLOAD ──────────────────────────────────────────── */
function connectGenericBulkUpload() {
  const form = $("#genericBulkUploadForm");
  if (!form) return;
  const courseSelect = form.querySelector('[name="courseCode"]');
  if (courseSelect && !courseSelect.options.length) {
    [...firstSemesterCourses, ...secondSemesterCourses].forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.code; opt.textContent = `${c.code} — ${c.title}`;
      courseSelect.appendChild(opt);
    });
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const folderInput = $("#genericBulkFiles");
    const looseInput = $("#genericBulkLooseFiles");
    const files = [...(folderInput?.files || []), ...(looseInput?.files || [])];
    const courseCode = (new FormData(form)).get("courseCode");
    if (!files.length || !courseCode) return showToast("Select files and a course.", "error");

    const total = files.length;
    let uploaded = 0;
    const status = $("#genericBulkStatus");
    const backend = window.__PHYSIOK29_BACKEND__;

    for (const file of files) {
      try {
        await backend.uploadResource({ courseCode, title: file.name, type: "Resource", note: "" }, file);
        uploaded++;
        if (status) status.textContent = `${uploaded}/${total} uploaded`;
      } catch (err) {
        console.warn("Bulk upload failed for", file.name, err);
      }
    }
    showToast(`${uploaded} of ${total} files uploaded.`);
    form.reset();
    if (status) status.textContent = "";
  });
}

/* ── RENDER: Birthday Dashboard ───────────────────────────── */
let cachedBirthdayList = [];
let birthdayListLoading = false;

async function loadBirthdayList() {
  if (birthdayListLoading) return cachedBirthdayList;
  birthdayListLoading = true;
  try {
    const backend = window.__PHYSIOK29_BACKEND__;
    cachedBirthdayList = await backend.getBirthdayList();
  } catch {
    cachedBirthdayList = [];
  }
  birthdayListLoading = false;
  return cachedBirthdayList;
}

function getUpcomingBirthdays(memberList) {
  const today = new Date();
  const todayMD = today.getMonth() * 100 + today.getDate();
  return memberList
    .filter((m) => m.dateOfBirth)
    .map((m) => {
      const parts = m.dateOfBirth.split("-");
      const dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dobMD = dob.getMonth() * 100 + dob.getDate();
      let diff = dobMD - todayMD;
      if (diff < 0) diff += 1200;
      return { ...m, diff, dob };
    })
    .filter((m) => m.diff >= 0 && m.diff <= 14)
    .sort((a, b) => a.diff - b.diff);
}

function renderBirthdayDashboard() {
  const grid = $("#adminCardGrid");
  if (!grid) return;
  const upcoming = getUpcomingBirthdays(cachedBirthdayList);
  const totalRegistered = cachedBirthdayList.length;
  const tomorrow = upcoming.filter((m) => m.diff === 1);
  const nextWeek = upcoming.filter((m) => m.diff >= 4 && m.diff <= 14);

  grid.insertAdjacentHTML("beforeend", `
    <article class="admin-card" id="birthdayDashboardCard">
      <div class="admin-card-header"><span class="material-symbols-rounded">celebration</span><h3>Birthdays</h3></div>
      <div class="admin-card-body"><strong>${totalRegistered}</strong> registered &middot; <strong>${upcoming.length}</strong> in 2 weeks${tomorrow.length ? `<br><strong>🎉 ${tomorrow.length} tomorrow!</strong>` : ""}</div>
      <div class="admin-card-footer"><span class="admin-card-stat">${nextWeek.length} next week</span><button class="ghost-action compact-action" data-open-birthday-manager>View All</button></div>
    </article>`);

  grid.querySelector("[data-open-birthday-manager]")?.addEventListener("click", () => renderBirthdayManager(upcoming));
}

function renderBirthdayManager(upcoming) {
  if ($("#birthdayManagerModal")) return;
  const allMembers = cachedBirthdayList;
  const overlay = document.createElement("section");
  overlay.id = "birthdayManagerModal";
  overlay.className = "edit-modal";
  overlay.innerHTML = `
    <article class="edit-card" style="max-width:800px">
      <header><div><p class="eyebrow">Class Birthdays</p><h2>Birthday Manager</h2><p class="form-help">Search profiles.</p></div>
        <button type="button" class="icon-button" data-close-edit><span class="material-symbols-rounded">close</span></button></header>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <input type="text" id="birthdayManagerSearch" placeholder="Search by name or month..." style="flex:1;min-width:180px;" />
        <select id="birthdayManagerMonth" style="min-width:140px;">
          <option value="">All months</option>
          ${["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => `<option value="${i}">${m}</option>`).join("")}
        </select>
      </div>
      <div style="margin-bottom:12px"><button class="secondary-action" data-trigger-birthday-notify><span class="material-symbols-rounded">notifications</span> Test Notification</button> <small id="birthdayNotificationStatus" style="color:var(--muted)"></small></div>
      <div id="birthdayManagerResults" style="max-height:50vh;overflow-y:auto"></div>
    </article>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-close-edit]")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("[data-trigger-birthday-notify]")?.addEventListener("click", triggerBirthdayNotification);

  const results = $("#birthdayManagerResults");
  const searchInput = $("#birthdayManagerSearch");
  const monthSelect = $("#birthdayManagerMonth");

  function filter() {
    const q = searchInput.value.trim().toLowerCase();
    const m = monthSelect.value;
    let filtered = allMembers;
    if (q) filtered = filtered.filter((x) => (x.fullName || x.name || "").toLowerCase().includes(q) || (x.matricNumber || "").toLowerCase().includes(q));
    if (m !== "") filtered = filtered.filter((x) => x.dateOfBirth && Number(x.dateOfBirth.split("-")[1]) - 1 === Number(m));
    results.innerHTML = filtered.length
      ? filtered.map((x) => {
          const dob = x.dateOfBirth ? new Date(x.dateOfBirth.split("-")[0], Number(x.dateOfBirth.split("-")[1]) - 1, x.dateOfBirth.split("-")[2]) : null;
          const dobStr = dob ? dob.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
          const isUpcoming = upcoming.some((u) => u.id === x.id);
          const photo = x.photoUrl ? `<img src="${escapeHtml(x.photoUrl)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" />` : `<span style="width:48px;height:48px;border-radius:50%;background:var(--surface-alt);display:flex;align-items:center;justify-content:center"><span class="material-symbols-rounded">person</span></span>`;
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;background:${isUpcoming ? "var(--surface-accent)" : "transparent"};margin-bottom:4px">${photo}<div style="flex:1"><strong>${escapeHtml(x.fullName || x.name)}</strong><br><small>${escapeHtml(x.matricNumber)}</small></div><div style="text-align:right"><div>${dobStr}</div>${isUpcoming ? '<small style="color:var(--accent)">Upcoming</small>' : ""}</div>${x.photoUrl ? `<a class="secondary-action compact-action" href="${escapeHtml(x.photoUrl)}" download style="font-size:12px;padding:4px 10px;text-decoration:none">Download</a>` : ""}</div>`;
        }).join("")
      : '<p style="text-align:center;padding:40px;color:var(--text-muted)">No matches.</p>';
  }
  searchInput.addEventListener("input", filter);
  monthSelect.addEventListener("change", filter);
  filter();
}

async function triggerBirthdayNotification() {
  const statusEl = $("#birthdayNotificationStatus");
  if (statusEl) statusEl.textContent = "Sending...";
  const btn = document.querySelector("[data-trigger-birthday-notify]");
  if (btn) btn.disabled = true;
  try {
    const supabaseUrl = "https://rfrlddiebyfojnzbfldy.supabase.co";
    const res = await fetch(`${supabaseUrl}/functions/v1/birthday-notify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const msg = data?.results?.length ? `Sent: ${data.results.map((r) => `${r.type} (${r.count})`).join(", ")}${data.webhookSent ? " + webhook" : ""}` : data?.message || "No upcoming birthdays.";
    if (statusEl) statusEl.textContent = msg;
    showToast(msg);
  } catch (err) {
    const msg = err.message || "Notification failed.";
    if (statusEl) statusEl.textContent = msg;
    showToast(msg, "error");
  }
  if (btn) btn.disabled = false;
}

/* ── EXPORTS / DOWNLOADS ──────────────────────────────────── */
function connectMembersCsvExport() {
  const btn = $("#exportMembersCsv");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const s = getState();
    const members = s.members || [];
    const header = "Name,Matric Number,Push Status,Streak,Last Seen";
    const rows = members.map((m) => `"${(m.name || "").replace(/"/g, '""')}","${(m.matricNumber || "").replace(/"/g, '""')}","${m.notificationEnabled ? "On" : "Off"}",${getMemberStreak(m.id)},"${formatDate(m.lastSeenAtMs || m.createdAtMs)}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "PhysioK29-Members.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Members CSV downloaded.");
  });
}

/* ── STAFF TABS ───────────────────────────────────────────── */
function connectStaffTabs() {
  const tabs = document.querySelectorAll(".staff-section-tabs");
  tabs.forEach((tabGroup) => {
    tabGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-staff-tab]");
      if (!btn) return;
      const tab = btn.dataset.staffTab;
      document.querySelectorAll("[data-staff-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".content-panel").forEach((p) => { p.hidden = p.id !== tab; });
      window.location.hash = `#${tab}`;
    });

    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const targetBtn = tabGroup.querySelector(`[data-staff-tab="${hash}"]`);
      if (targetBtn) {
        targetBtn.click();
        return;
      }
    }
    const firstBtn = tabGroup.querySelector("[data-staff-tab]");
    if (firstBtn) firstBtn.click();
  });
}

/* ── INIT ─────────────────────────────────────────────────── */
function renderStaffPortal() {
  renderStaffSummary();
  renderAdminDashboard();
  renderStaffMonitor();
  renderStaffStudyAnalytics();
  renderStaffLists();
  renderMembersTable();
  renderRepSummary();
  if (isAdminPortal()) {
    loadBirthdayList();
  }
}

function initExecutivePortal() {
  connectStaffPortal(document.body.dataset.portalRole === "admin" ? ["admin"] : ["rep", "admin"]);
  connectRepForms();
  connectGenericBulkUpload();
  connectStaffTabs();
  connectMembersCsvExport();
  connectAnalyticsPdfDownload();
  connectMembersPdfDownload();
}

/* ── PDF DOWNLOADS ────────────────────────────────────────── */
function connectAnalyticsPdfDownload() {
  const btn = $("#downloadAnalyticsPdf");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const panel = $("#staffStudyAnalytics");
    if (!panel) return showToast("Analytics panel not found.", "error");
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/+esm");
      const html2pdf = mod.default;
      html2pdf().set({ margin: 10, filename: "PhysioK29-Study-Analytics.pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }).from(panel).save();
      showToast("Downloading analytics PDF...");
    } catch { showToast("PDF library not available.", "error"); }
  });
}

function connectMembersPdfDownload() {
  const btn = $("#downloadMembersPdf");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const table = $("#membersTableBody");
    if (!table) return showToast("Members table not found.", "error");
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/+esm");
      const html2pdf = mod.default;
      html2pdf().set({ margin: 10, filename: "PhysioK29-Members.pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "landscape" } }).from(table).save();
      showToast("Downloading members PDF...");
    } catch { showToast("PDF library not available.", "error"); }
  });
}

/* ── CONNECT STAFF ACTIONS ────────────────────────────────── */
function connectStaffActions() {
  // Edit/Delete handlers are attached in renderStaffLists()
}

/* ── START ────────────────────────────────────────────────── */
export { initExecutivePortal, connectStaffPortal as testStaffAuth };

// Auto-init if we're on a staff page
if (document.body.dataset.portal === "staff") {
  document.addEventListener("DOMContentLoaded", () => {
    // Wait for app.js to finish initializing
    const checkReady = setInterval(() => {
      if (window.__PHYSIOK29_BACKEND__) {
        clearInterval(checkReady);
        initExecutivePortal();
      }
    }, 100);
    setTimeout(() => clearInterval(checkReady), 30000);
  });
}
