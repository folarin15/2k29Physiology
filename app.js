import { cbtTimetable, findCourse, firstSemesterCourses, resourceTypes } from "./data.js";
import { createBackend } from "./supabase-service.js";
import { isSupabaseConfigured } from "./supabase-config.js";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";

const state = {
  backend: null,
  resources: [],
  announcements: [],
  members: [],
  suggestions: [],
  staffUser: null,
  staffRole: null,
  membersUnsubscribe: null,
  suggestionsUnsubscribe: null,
  live: {
    resources: { loaded: false, ids: new Set() },
    announcements: { loaded: false, ids: new Set() },
    suggestions: { loaded: false, ids: new Set() },
  },
};

/* DOM UTILITY: Keeps page-specific rendering safe across all HTML files. */
function getElement(selector) {
  return document.querySelector(selector);
}

function getElements(selector) {
  return [...document.querySelectorAll(selector)];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function courseAnchor(code) {
  return code.replace(/\s+/g, "-");
}

function formatDate(ms) {
  if (!ms) return "Just now";
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function getMemberSession() {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY));
  } catch {
    return null;
  }
}

function saveMemberSession(session) {
  localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
}

function clearMemberSession() {
  localStorage.removeItem(MEMBER_SESSION_KEY);
}

function shouldResetMemberSession() {
  return new URLSearchParams(window.location.search).has("resetStudent");
}

function showToast(message, tone = "default") {
  let toast = getElement("#portalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "portalToast";
    toast.className = "portal-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4200);
}

/* FOOTER CREDIT: Keeps the creator mark present without competing with the portal UI. */
function renderSiteCredit() {
  const main = getElement(".main-area");
  if (!main || getElement(".site-credit")) return;

  const credit = document.createElement("footer");
  credit.className = "site-credit";
  credit.textContent = "© 2026 Maverick";
  main.appendChild(credit);
}

function rememberLiveItems(key, items, messageBuilder) {
  const bucket = state.live[key];
  const nextIds = new Set(items.map((item) => item.id));

  if (!bucket.loaded) {
    bucket.loaded = true;
    bucket.ids = nextIds;
    return;
  }

  const freshItems = items.filter((item) => !bucket.ids.has(item.id));
  bucket.ids = nextIds;

  if (freshItems.length) {
    showToast(messageBuilder(freshItems[0], freshItems.length));
  }
}

/* SIDEBAR COURSE SHORTCUTS: Kept for compatibility if a page re-adds the container later. */
function renderSidebarCourses() {
  const target = getElement("#sidebarCourseList");
  if (!target) return;

  target.innerHTML = firstSemesterCourses
    .map(
      (course) => `
        <a class="course-chip" href="./courses.html#${courseAnchor(course.code)}">
          <span>${course.code}</span>
          <small>${course.units}u</small>
        </a>
      `
    )
    .join("");
}

/* STUDENT ONBOARDING: Collects name and matric once, then refreshes the member record. */
async function ensureMemberOnboarding() {
  if (document.body.dataset.portal === "staff") return;

  if (shouldResetMemberSession()) {
    clearMemberSession();
  }

  const existingSession = getMemberSession();
  if (existingSession?.memberId) {
    const active = await state.backend.refreshMemberSession(existingSession).catch(() => true);
    if (active !== false) return;
    clearMemberSession();
  }

  const overlay = document.createElement("section");
  overlay.className = "member-modal";
  overlay.innerHTML = `
    <form class="member-card" id="memberOnboardingForm">
      <img src="./assets/ui-logo.jpeg" alt="University of Ibadan logo" />
      <p class="eyebrow">Class check-in</p>
      <h2>Welcome to Physiology Class 2k29</h2>
      <p class="form-help">Enter your name and matric number once. This keeps the class list accurate for reps and admin.</p>
      <label>
        Full name
        <input name="name" type="text" placeholder="e.g. Suberu Igbobamiji Barawo" autocomplete="name" required />
      </label>
      <label>
        Matric number
        <input name="matricNumber" type="text" placeholder="e.g. 123456" autocomplete="off" required />
      </label>
      <button class="primary-action" type="submit">Enter portal</button>
      <p class="form-status" id="memberOnboardingStatus"></p>
    </form>
  `;
  document.body.appendChild(overlay);

  const form = getElement("#memberOnboardingForm");
  const status = getElement("#memberOnboardingStatus");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const profile = {
      name: String(formData.get("name")).trim(),
      matricNumber: String(formData.get("matricNumber")).trim(),
    };

    try {
      status.textContent = "Saving your class profile...";
      const session = await state.backend.registerMember(profile);
      const memberSession = {
        ...session,
        name: profile.name,
        matricNumber: profile.matricNumber,
        savedAt: Date.now(),
      };
      saveMemberSession(memberSession);

      overlay.remove();
      showToast("Welcome. Your class profile is saved.");
    } catch (error) {
      status.textContent = error.message || "Could not save profile. Please try again.";
    }
  });
}

/* METRICS COMPONENT: Combines fixed course counts with live backend records. */
function renderDashboardMetrics() {
  const courseCount = getElement("#courseCount");
  const resourceCount = getElement("#resourceCount");
  const timetableCount = getElement("#timetableCount");
  const memberCount = getElement("#memberCount");

  if (courseCount) courseCount.textContent = firstSemesterCourses.length;
  if (resourceCount) resourceCount.textContent = state.resources.length;
  if (timetableCount) timetableCount.textContent = cbtTimetable.length;
  if (memberCount) memberCount.textContent = state.members.length || "Private";
}

function resourceCard(resource) {
  const resourceUrl = resource.downloadUrl || "#";

  return `
    <article class="resource-card">
      <div class="card-topline">
        <span class="course-code">${escapeHtml(resource.courseCode)}</span>
        <span class="unit-pill">${escapeHtml(resource.type || "Resource")}</span>
      </div>
      <div>
        <h3>${escapeHtml(resource.title)}</h3>
        <p>${escapeHtml(resource.note || resource.fileName || "Uploaded class material")}</p>
      </div>
      <div class="resource-meta">
        <span>${escapeHtml(resource.uploadedBy || "Course rep")}</span>
        <span>${formatDate(resource.createdAtMs)}</span>
      </div>
      <a class="card-action" href="${escapeHtml(resourceUrl)}" target="_blank" rel="noreferrer">
        <span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>
        Open file
      </a>
    </article>
  `;
}

/* RESOURCE BOARD: Renders live uploads, or an honest empty/setup state. */
function renderResourceCards(items = state.resources) {
  const grid = getElement("#resourceGrid");
  const empty = getElement("#emptySearch");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `
      <article class="resource-card setup-card">
        <span class="course-code">No uploads yet</span>
        <div>
          <h3>${isSupabaseConfigured() ? "Waiting for course reps" : "Supabase setup needed"}</h3>
          <p>${
            isSupabaseConfigured()
              ? "New slides and materials will appear here once they are posted."
              : "Paste your Supabase project URL and anon key in supabase-config.js to activate live resources."
          }</p>
        </div>
        <a class="card-action" href="./courses.html">View courses</a>
      </article>
    `;
    if (empty) empty.hidden = true;
    return;
  }

  grid.innerHTML = items.slice(0, 12).map(resourceCard).join("");
  if (empty) empty.hidden = items.length > 0;
}

/* COURSE PAGE: Shows fixed courses and live resource counts by course. */
function renderCourseGrid() {
  const grid = getElement("#courseGrid");
  const count = getElement("#coursePageCount");
  if (!grid) return;

  if (count) count.textContent = `${firstSemesterCourses.length} courses`;

  grid.innerHTML = firstSemesterCourses
    .map((course) => {
      const resources = state.resources.filter((resource) => resource.courseCode === course.code);
      const latest = resources.slice(0, 3);
      return `
        <article class="course-card" id="${courseAnchor(course.code)}">
          <div class="card-topline">
            <span class="course-code">${course.code}</span>
            <span class="unit-pill">${course.units} unit${course.units > 1 ? "s" : ""}</span>
          </div>
          <div>
            <h3>${escapeHtml(course.title)}</h3>
            <p>${course.type}. ${resources.length} posted resource${resources.length === 1 ? "" : "s"}.</p>
          </div>
          <div class="mini-resource-list">
            ${
              latest.length
                ? latest
                    .map(
                      (resource) =>
                        `<a href="${escapeHtml(resource.downloadUrl || "#")}" target="_blank" rel="noreferrer">${escapeHtml(resource.title)}</a>`
                    )
                    .join("")
                : "<span>No resources yet</span>"
            }
          </div>
        </article>
      `;
    })
    .join("");
}

/* TIMETABLE PAGE: Renders the CBT rows from the extracted document. */
function renderTimetable() {
  const body = getElement("#timetableBody");
  const count = getElement("#timetablePageCount");
  if (!body) return;

  if (count) count.textContent = `${cbtTimetable.length} rows`;

  body.innerHTML = cbtTimetable
    .map(
      (item) => `
        <tr>
          <td>${item.course}</td>
          <td>${item.day}</td>
          <td>${item.date}</td>
          <td>${item.batch}</td>
          <td>${item.duration}</td>
          <td>${item.time}</td>
        </tr>
      `
    )
    .join("");
}

/* ANNOUNCEMENT BOARD: Renders live rep/admin announcements. */
function renderAnnouncements() {
  const target = getElement("#announcementList");
  if (!target) return;

  if (!state.announcements.length) {
    target.innerHTML = `
      <article>
        <span>Now</span>
        <p>Announcements from Ayanfe, Raphael, and admin will appear here.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = state.announcements
    .slice(0, 8)
    .map(
      (announcement) => `
        <article>
          <span>${formatDate(announcement.createdAtMs)}</span>
          <p><strong>${escapeHtml(announcement.title)}</strong> ${escapeHtml(announcement.message)}</p>
        </article>
      `
    )
    .join("");
}

function canDeleteResource(resource) {
  return state.staffRole === "admin" || resource.uploadedByUid === state.staffUser?.id;
}

function canDeleteAnnouncement(announcement) {
  return state.staffRole === "admin" || announcement.postedByUid === state.staffUser?.id;
}

function isAdminPortal() {
  return document.body.dataset.portalRole === "admin";
}

function renderMembersTable() {
  const body = getElement("#membersTableBody");
  const count = getElement("#membersCount");
  if (!body) return;

  const canDeleteMembers = isAdminPortal();
  if (count) count.textContent = `${state.members.length} members`;

  body.innerHTML = state.members.length
    ? state.members
        .map(
          (member) => `
            <tr>
              <td>${escapeHtml(member.name)}</td>
              <td>${escapeHtml(member.matricNumber)}</td>
              <td>Registered</td>
              <td>${formatDate(member.lastSeenAtMs || member.createdAtMs)}</td>
              ${
                canDeleteMembers
                  ? `<td><button class="danger-link" data-delete-member="${member.id}">Delete</button></td>`
                  : ""
              }
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="${canDeleteMembers ? 5 : 4}">No class members yet.</td></tr>`;
}

function renderStaffLists() {
  const resourcesBody = getElement("#staffResourcesBody") || getElement("#adminResourcesBody");
  const announcementsBody = getElement("#staffAnnouncementsBody") || getElement("#adminAnnouncementsBody");
  const suggestionsBody = getElement("#staffSuggestionsBody");

  if (resourcesBody) {
    resourcesBody.innerHTML = state.resources.length
      ? state.resources
          .map((resource) => {
            const action = canDeleteResource(resource)
              ? `<button class="danger-link" data-delete-resource="${resource.id}">Delete</button>`
              : `<span class="muted-cell">Owner only</span>`;
            return `
              <tr>
                <td>${escapeHtml(resource.title)}</td>
                <td>${escapeHtml(resource.courseCode)}</td>
                <td>${escapeHtml(resource.uploadedBy || "Course rep")}</td>
                <td>${action}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="4">No uploads yet.</td></tr>`;
  }

  if (announcementsBody) {
    announcementsBody.innerHTML = state.announcements.length
      ? state.announcements
          .map((announcement) => {
            const action = canDeleteAnnouncement(announcement)
              ? `<button class="danger-link" data-delete-announcement="${announcement.id}">Delete</button>`
              : `<span class="muted-cell">Owner only</span>`;
            return `
              <tr>
                <td>${escapeHtml(announcement.title)}</td>
                <td>${escapeHtml(announcement.priority || "Normal")}</td>
                <td>${escapeHtml(announcement.postedBy || "Course rep")}</td>
                <td>${action}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="4">No announcements yet.</td></tr>`;
  }

  if (suggestionsBody) {
    suggestionsBody.innerHTML = state.suggestions.length
      ? state.suggestions
          .map(
            (suggestion) => `
              <tr>
                <td>
                  <strong>${escapeHtml(suggestion.name)}</strong>
                  <small>${escapeHtml(suggestion.matricNumber)}</small>
                </td>
                <td>${escapeHtml(suggestion.category || "General")}</td>
                <td>${escapeHtml(suggestion.message)}</td>
                <td>${formatDate(suggestion.createdAtMs)}</td>
                <td>${
                  isAdminPortal()
                    ? `<button class="danger-link" data-delete-suggestion="${suggestion.id}">Delete</button>`
                    : `<span class="muted-cell">Visible</span>`
                }</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5">No suggestions yet.</td></tr>`;
  }
}

function renderAll() {
  renderSiteCredit();
  renderSidebarCourses();
  renderDashboardMetrics();
  renderResourceCards();
  renderCourseGrid();
  renderTimetable();
  renderAnnouncements();
  renderMembersTable();
  renderStaffLists();
}

/* SEARCH BEHAVIOR: Filters live uploads first, then course cards if no uploads exist. */
function connectSearch() {
  const input = getElement("#resourceSearch");
  if (!input) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const source = state.resources.length
      ? state.resources
      : firstSemesterCourses.map((course) => ({
          title: course.title,
          courseCode: course.code,
          type: course.type,
          note: "Course folder will fill up when reps upload files.",
          downloadUrl: "./courses.html",
        }));

    const matches = source.filter((item) =>
      `${item.title} ${item.courseCode} ${item.type} ${item.note || ""}`.toLowerCase().includes(query)
    );

    renderResourceCards(matches);
  });
}

function populateCourseSelects() {
  getElements("[data-course-select]").forEach((select) => {
    select.innerHTML = firstSemesterCourses
      .map((course) => `<option value="${course.code}">${course.code} - ${escapeHtml(course.title)}</option>`)
      .join("");
  });

  getElements("[data-type-select]").forEach((select) => {
    select.innerHTML = resourceTypes.map((type) => `<option value="${type}">${type}</option>`).join("");
  });
}

/* REP/ADMIN AUTH: Protects staff portals through Supabase Auth + staff_roles table. */
function connectStaffPortal(allowedRoles) {
  const loginForm = getElement("#staffLoginForm");
  const portal = getElement("#staffPortal");
  const loginPanel = getElement("#staffLoginPanel");
  const status = getElement("#staffStatus");
  const signOut = getElement("#staffSignOut");
  if (!loginForm || !portal || !loginPanel) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    try {
      status.textContent = "Signing in...";
      await state.backend.signInRep(String(formData.get("email")), String(formData.get("password")));
      status.textContent = "";
    } catch (error) {
      status.textContent = error.message || "Could not sign in.";
    }
  });

  if (signOut) {
    signOut.addEventListener("click", () => state.backend.signOutRep());
  }

  state.backend.onAuth((user, role) => {
    const canEnter = Boolean(user && role && allowedRoles.includes(role.role));
    state.staffUser = canEnter ? user : null;
    state.staffRole = canEnter ? role.role : null;
    portal.hidden = !canEnter;
    loginPanel.hidden = canEnter;
    if (signOut) signOut.hidden = !canEnter;

    if (canEnter && !state.membersUnsubscribe && getElement("#membersTableBody")) {
      state.membersUnsubscribe = state.backend.watchMembers(
        (members) => {
          state.members = members;
          renderDashboardMetrics();
          renderMembersTable();
        },
        (error) => showToast(error.message || "Could not load members.", "error")
      );
    }

    if (canEnter && !state.suggestionsUnsubscribe && getElement("#staffSuggestionsBody")) {
      state.suggestionsUnsubscribe = state.backend.watchSuggestions(
        (suggestions) => {
          state.suggestions = suggestions;
          rememberLiveItems("suggestions", suggestions, (item) => `New suggestion from ${item.name}.`);
          renderStaffLists();
        },
        (error) => showToast(error.message || "Could not load suggestions.", "error")
      );
    }

    if (!canEnter && state.membersUnsubscribe) {
      state.membersUnsubscribe();
      state.membersUnsubscribe = null;
      state.members = [];
      renderMembersTable();
    }

    if (!canEnter && state.suggestionsUnsubscribe) {
      state.suggestionsUnsubscribe();
      state.suggestionsUnsubscribe = null;
      state.suggestions = [];
      renderStaffLists();
    }

    renderStaffLists();

    if (user && !canEnter) {
      status.textContent = "This account is not allowed to access this portal.";
    }
  });
}

/* REP/ADMIN FORMS: Uploads files and posts announcements. */
function connectRepForms() {
  const uploadForm = getElement("#resourceUploadForm");
  const announcementForm = getElement("#announcementForm");
  const uploadStatus = getElement("#uploadStatus");
  const announcementStatus = getElement("#announcementStatus");

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(uploadForm);
      const file = formData.get("file");
      const course = findCourse(String(formData.get("courseCode")));

      try {
        uploadStatus.textContent = "Uploading...";
        await state.backend.uploadResource(
          {
            title: String(formData.get("title")).trim(),
            courseCode: String(formData.get("courseCode")),
            courseTitle: course?.title || "",
            type: String(formData.get("type")),
            note: String(formData.get("note")).trim(),
          },
          file,
          (progress) => {
            uploadStatus.textContent = `Uploading... ${progress}%`;
          }
        );
        uploadForm.reset();
        populateCourseSelects();
        uploadStatus.textContent = "Upload saved.";
      } catch (error) {
        uploadStatus.textContent = error.message || "Upload failed.";
      }
    });
  }

  if (announcementForm) {
    announcementForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(announcementForm);
      try {
        announcementStatus.textContent = "Posting announcement...";
        await state.backend.postAnnouncement({
          title: String(formData.get("title")).trim(),
          message: String(formData.get("message")).trim(),
          priority: String(formData.get("priority")),
        });
        announcementForm.reset();
        announcementStatus.textContent = "Announcement posted.";
      } catch (error) {
        announcementStatus.textContent = error.message || "Announcement failed.";
      }
    });
  }
}

/* SUGGESTION FORM: Lets checked-in students send structured notes to staff. */
function connectSuggestionForm() {
  const form = getElement("#suggestionForm");
  const status = getElement("#suggestionStatus");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const session = getMemberSession();
    if (!session?.memberId) {
      status.textContent = "Complete the class check-in first, then send your suggestion.";
      return;
    }

    const formData = new FormData(form);
    try {
      status.textContent = "Sending suggestion...";
      await state.backend.submitSuggestion({
        name: session.name,
        matricNumber: session.matricNumber,
        category: String(formData.get("category")),
        message: String(formData.get("message")).trim(),
      });
      form.reset();
      status.textContent = "Suggestion sent. Thank you.";
      showToast("Suggestion sent to the reps and admin.");
    } catch (error) {
      status.textContent = error.message || "Could not send suggestion.";
    }
  });
}

/* STAFF ACTIONS: Deletes resources, announcements, suggestions, and member records. */
function connectStaffActions() {
  document.addEventListener("click", async (event) => {
    const resourceButton = event.target.closest("[data-delete-resource]");
    const announcementButton = event.target.closest("[data-delete-announcement]");
    const suggestionButton = event.target.closest("[data-delete-suggestion]");
    const memberButton = event.target.closest("[data-delete-member]");

    try {
      if (resourceButton) {
        const resource = state.resources.find((item) => item.id === resourceButton.dataset.deleteResource);
        if (!resource || !confirm(`Delete "${resource.title}"?`)) return;
        await state.backend.deleteResource(resource);
        showToast("Resource deleted.");
      }

      if (announcementButton) {
        const id = announcementButton.dataset.deleteAnnouncement;
        if (!confirm("Delete this announcement?")) return;
        await state.backend.deleteAnnouncement(id);
        showToast("Announcement deleted.");
      }

      if (suggestionButton) {
        const id = suggestionButton.dataset.deleteSuggestion;
        if (!confirm("Delete this suggestion?")) return;
        await state.backend.deleteSuggestion(id);
        showToast("Suggestion deleted.");
      }

      if (memberButton) {
        const member = state.members.find((item) => item.id === memberButton.dataset.deleteMember);
        if (!member || !confirm(`Delete ${member.name} from the class list?`)) return;
        await state.backend.deleteMember(member.id);
        showToast("Member deleted from the class list.");
      }
    } catch (error) {
      showToast(error.message || "Action failed.", "error");
    }
  });
}

/* COPY BUTTONS: Copies class rep phone numbers from the reps page. */
function connectCopyButtons() {
  getElements("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        showToast("Phone number copied.");
      } catch {
        showToast(value);
      }
    });
  });
}

/* PDF TEXT HELPERS: Keep the generated timetable PDF browser-native and library-free. */
function sanitizePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return sanitizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fitPdfText(value, maxCharacters) {
  const text = sanitizePdfText(value);
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, Math.max(0, maxCharacters - 3))}...`;
}

function pdfText(x, y, text, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function pdfLine(x1, y1, x2, y2) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

/* TIMETABLE PDF: Generates a compact landscape PDF for offline timetable sharing. */
function createTimetablePdfBlob() {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 28;
  const rowsPerPage = 13;
  const columns = [
    { label: "Course", key: "course", width: 78, max: 12 },
    { label: "Day", key: "day", width: 128, max: 22 },
    { label: "Date", key: "date", width: 92, max: 14 },
    { label: "Batch", key: "batch", width: 82, max: 14 },
    { label: "Duration", key: "duration", width: 86, max: 14 },
    { label: "Time", key: "time", width: tableWidth - 466, max: 34 },
  ];
  const pages = [];

  for (let start = 0; start < cbtTimetable.length; start += rowsPerPage) {
    const pageRows = cbtTimetable.slice(start, start + rowsPerPage);
    const pageNumber = pages.length + 1;
    const totalPages = Math.ceil(cbtTimetable.length / rowsPerPage) || 1;
    const tableTop = 470;
    const headerBottom = tableTop - 28;
    const operations = [
      "1 1 1 rg 0 0 842 595 re f",
      "0.09 0.11 0.12 rg",
      pdfText(margin, 548, "PhysioK29 CBT Timetable", 20, "F2"),
      "0.39 0.44 0.42 rg",
      pdfText(margin, 528, "GES/GST first-semester rows matched to Physiology Class 2k29.", 10),
      pdfText(margin, 512, `Generated from the class portal. Page ${pageNumber} of ${totalPages}.`, 9),
      "0.88 0.96 0.93 rg",
      `${margin} ${headerBottom} ${tableWidth} 28 re f`,
      "0.82 0.80 0.74 RG",
      `${margin} ${headerBottom} ${tableWidth} 28 re S`,
    ];

    let cursorX = margin;
    columns.forEach((column) => {
      operations.push("0.09 0.11 0.12 rg", pdfText(cursorX + 7, tableTop - 18, column.label, 9, "F2"));
      cursorX += column.width;
    });

    pageRows.forEach((item, rowIndex) => {
      const rowTop = headerBottom - rowIndex * rowHeight;
      const rowBottom = rowTop - rowHeight;
      operations.push("0.82 0.80 0.74 RG", pdfLine(margin, rowBottom, margin + tableWidth, rowBottom));
      cursorX = margin;
      columns.forEach((column) => {
        const cell = fitPdfText(item[column.key], column.max);
        operations.push("0.09 0.11 0.12 rg", pdfText(cursorX + 7, rowBottom + 10, cell, 9));
        cursorX += column.width;
      });
    });

    operations.push(
      "0.39 0.44 0.42 rg",
      pdfText(margin, 44, "Confirm your exact CBT batch before exam day.", 9),
      pdfText(pageWidth - 132, 44, "PhysioK29", 9, "F2")
    );
    pages.push(operations.join("\n"));
  }

  const maxObjectId = 4 + pages.length * 2;
  const regularFontId = 3;
  const boldFontId = 4;
  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${
        pages.length
      } >>`,
    },
    { id: regularFontId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { id: boldFontId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" },
  ];

  pages.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    objects.push({
      id: pageId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    });
    objects.push({
      id: contentId,
      body: `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    });
  });

  const offsets = new Array(maxObjectId + 1).fill(0);
  let pdf = "%PDF-1.4\n";
  objects
    .sort((a, b) => a.id - b.id)
    .forEach((object) => {
      offsets[object.id] = pdf.length;
      pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
    });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxObjectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

/* TIMETABLE DOWNLOAD: Builds a PDF file from the displayed CBT rows. */
function connectTimetableDownload() {
  const button = getElement("#downloadTimetable");
  if (!button) return;

  button.addEventListener("click", () => {
    const blob = createTimetablePdfBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "physiok29-ges-gst-cbt-timetable.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

function connectRealtimeData() {
  state.backend.watchResources(
    (resources) => {
      state.resources = resources;
      rememberLiveItems("resources", resources, (item) => `New ${item.type || "resource"} posted: ${item.title}`);
      renderAll();
    },
    (error) => showToast(error.message || "Could not load resources.", "error")
  );

  state.backend.watchAnnouncements(
    (announcements) => {
      state.announcements = announcements;
      rememberLiveItems("announcements", announcements, (item) => `New announcement: ${item.title}`);
      renderAll();
    },
    (error) => showToast(error.message || "Could not load announcements.", "error")
  );

  renderMembersTable();
}

async function init() {
  state.backend = await createBackend();
  populateCourseSelects();
  renderAll();
  connectSearch();
  connectStaffPortal(document.body.dataset.portalRole === "admin" ? ["admin"] : ["rep", "admin"]);
  connectRepForms();
  connectSuggestionForm();
  connectStaffActions();
  connectCopyButtons();
  connectTimetableDownload();
  connectRealtimeData();
  await ensureMemberOnboarding();
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "The portal could not start.", "error");
});
