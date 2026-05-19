import { cbtTimetable, findCourse, firstSemesterCourses, resourceTypes } from "./data.js";
import { createBackend } from "./firebase-service.js";
import { isFirebaseConfigured } from "./firebase-config.js";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const NOTIFICATION_ASKED_KEY = "physiology2k29.notificationAsked";

const state = {
  backend: null,
  resources: [],
  announcements: [],
  members: [],
  membersUnsubscribe: null,
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

/* SIDEBAR COMPONENT: Renders the fixed course shortcuts in the dark rail. */
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

/* STUDENT ONBOARDING: Collects name and matric once, then requests notifications. */
async function ensureMemberOnboarding() {
  if (document.body.dataset.portal === "staff") return;

  const existingSession = getMemberSession();
  if (existingSession?.memberId && existingSession?.sessionToken) {
    state.backend.refreshMemberSession(existingSession).catch(console.warn);
    return;
  }

  const overlay = document.createElement("section");
  overlay.className = "member-modal";
  overlay.innerHTML = `
    <form class="member-card" id="memberOnboardingForm">
      <img src="./assets/ui-logo.jpeg" alt="University of Ibadan logo" />
      <p class="eyebrow">Class member check-in</p>
      <h2>Welcome to Physiology Class 2k29</h2>
      <p class="form-help">Enter your name and matric number once. Reps and admin use this private list to know who has joined the class portal.</p>
      <label>
        Full name
        <input name="name" type="text" placeholder="e.g. Akinteye Akinbode" autocomplete="name" required />
      </label>
      <label>
        Matric number
        <input name="matricNumber" type="text" placeholder="e.g. 256492" autocomplete="off" required />
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

      if (!localStorage.getItem(NOTIFICATION_ASKED_KEY)) {
        localStorage.setItem(NOTIFICATION_ASKED_KEY, "true");
        status.textContent = "Profile saved. Checking notification permission...";
        const result = await state.backend.requestNotificationAccess(memberSession);
        if (result === "granted") showToast("Notifications enabled for new uploads and news.");
      }

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
  if (memberCount) memberCount.textContent = state.members.length || "2";
}

function resourceCard(resource) {
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
      <a class="card-action" href="${escapeHtml(resource.downloadUrl || "#")}" target="_blank" rel="noreferrer">Open file</a>
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
          <h3>${isFirebaseConfigured() ? "Waiting for course reps" : "Firebase setup needed"}</h3>
          <p>${
            isFirebaseConfigured()
              ? "Uploaded files will appear here automatically."
              : "Paste your Firebase web config in firebase-config.js to activate live resources."
          }</p>
        </div>
        <a class="card-action" href="./rep.html">Open rep portal</a>
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
            <p>${course.type}. ${resources.length} uploaded resource${resources.length === 1 ? "" : "s"}.</p>
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
                : "<span>No uploads yet</span>"
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

function renderMembersTable() {
  const body = getElement("#membersTableBody");
  const count = getElement("#membersCount");
  if (!body) return;

  if (count) count.textContent = `${state.members.length} members`;
  body.innerHTML = state.members.length
    ? state.members
        .map(
          (member) => `
            <tr>
              <td>${escapeHtml(member.name)}</td>
              <td>${escapeHtml(member.matricNumber)}</td>
              <td>${member.notificationEnabled ? "Enabled" : "Not enabled"}</td>
              <td>${formatDate(member.lastSeenAtMs || member.createdAtMs)}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4">No class members yet.</td></tr>`;
}

function renderAdminLists() {
  const resourcesBody = getElement("#adminResourcesBody");
  const announcementsBody = getElement("#adminAnnouncementsBody");

  if (resourcesBody) {
    resourcesBody.innerHTML = state.resources.length
      ? state.resources
          .map(
            (resource) => `
              <tr>
                <td>${escapeHtml(resource.title)}</td>
                <td>${escapeHtml(resource.courseCode)}</td>
                <td>${escapeHtml(resource.uploadedBy || "Course rep")}</td>
                <td><button class="danger-link" data-delete-resource="${resource.id}">Delete</button></td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="4">No uploads yet.</td></tr>`;
  }

  if (announcementsBody) {
    announcementsBody.innerHTML = state.announcements.length
      ? state.announcements
          .map(
            (announcement) => `
              <tr>
                <td>${escapeHtml(announcement.title)}</td>
                <td>${escapeHtml(announcement.priority || "Normal")}</td>
                <td>${escapeHtml(announcement.postedBy || "Course rep")}</td>
                <td><button class="danger-link" data-delete-announcement="${announcement.id}">Delete</button></td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="4">No announcements yet.</td></tr>`;
  }
}

function renderAll() {
  renderSidebarCourses();
  renderDashboardMetrics();
  renderResourceCards();
  renderCourseGrid();
  renderTimetable();
  renderAnnouncements();
  renderMembersTable();
  renderAdminLists();
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

/* REP/ADMIN AUTH: Protects staff portals through Firebase Auth + roles collection. */
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

    if (!canEnter && state.membersUnsubscribe) {
      state.membersUnsubscribe();
      state.membersUnsubscribe = null;
      state.members = [];
      renderMembersTable();
    }

    if (user && !canEnter) {
      status.textContent = "This account is not allowed to access this portal.";
    }
  });
}

/* REP PORTAL FORMS: Uploads files and posts announcements. */
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
        uploadStatus.textContent = "Upload saved and notification queued.";
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
        announcementStatus.textContent = "Announcement posted and notification queued.";
      } catch (error) {
        announcementStatus.textContent = error.message || "Announcement failed.";
      }
    });
  }
}

/* ADMIN ACTIONS: Lets the admin remove bad content from the portal. */
function connectAdminActions() {
  document.addEventListener("click", async (event) => {
    const resourceButton = event.target.closest("[data-delete-resource]");
    const announcementButton = event.target.closest("[data-delete-announcement]");

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
  });
}

function connectRealtimeData() {
  state.backend.watchResources(
    (resources) => {
      state.resources = resources;
      renderAll();
    },
    (error) => showToast(error.message || "Could not load resources.", "error")
  );

  state.backend.watchAnnouncements(
    (announcements) => {
      state.announcements = announcements;
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
  connectAdminActions();
  connectRealtimeData();
  await ensureMemberOnboarding();

  window.addEventListener("portal:message", (event) => {
    const title = event.detail?.notification?.title || "Physiology 2k29";
    showToast(title);
  });
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "The portal could not start.", "error");
});
