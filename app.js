import { cbtTimetable, findCourse, firstSemesterCourses, resourceTypes } from "./data.js";
import { createBackend } from "./supabase-service.js";
import { isSupabaseConfigured } from "./supabase-config.js";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const ONESIGNAL_PROMPT_KEY = "physiology2k29.onesignalPromptAsked";

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

const cosBulkMetadata = [
  {
    keys: ["fundamental_of_computer_science", "week 1"],
    title: "COS 101 Week 1: Fundamentals of Computer Science",
    type: "Slide",
    note: "Course overview and fundamentals: basic computing concepts, data representation, organization, networks, algorithms, and Visual Basic.",
  },
  {
    keys: ["history_and_generation", "week 2"],
    title: "COS 101 Week 2: History and Generations of Computing",
    type: "Slide",
    note: "Focuses on early computing devices, primitive calculators, and how modern computers developed.",
  },
  {
    keys: ["components_of_computer", "week 3-4"],
    title: "COS 101 Week 3-4: Components of Computer Systems",
    type: "Slide",
    note: "Focuses on hardware, software, system structure, and how computer components work together.",
  },
  {
    keys: ["software component", "week 4a"],
    title: "COS 101 Week 4a: System and Application Software",
    type: "Slide",
    note: "Focuses on system software, application software, program documentation, and the role of software in computing.",
  },
  {
    keys: ["data_representation", "data representation", "week 4b"],
    title: "COS 101 Week 4b: Data Representation",
    type: "Slide",
    note: "Focuses on how computers represent numbers, text, audio, images, video, analog and digital data, and compression.",
  },
  {
    keys: ["number systems", "week 5"],
    title: "COS 101 Week 5: Number Systems",
    type: "Slide",
    note: "Focuses on number bases, binary and decimal ideas, and the foundations of number system conversion.",
  },
  {
    keys: ["computernetwork", "computer network", "week7", "week 7"],
    title: "COS 101 Week 7: Computer Networks and Internet",
    type: "Slide",
    note: "Focuses on LAN, MAN, WAN, network uses, resource sharing, topology, and internet basics.",
  },
  {
    keys: ["problemsolving", "problem solving", "lecture 8"],
    title: "COS 101 Lecture 8: Problem Solving With Computers",
    type: "Slide",
    note: "Focuses on problem analysis, data processing, algorithm writing, and software development steps.",
  },
  {
    keys: ["csc 101 compiled", "sister iza"],
    title: "COS 101 Compiled Notes by Sister Iza",
    type: "Note",
    note: "Compiled COS 101 study material for broad revision across course topics.",
  },
];

/* DOM UTILITY: Keeps page-specific rendering safe across all HTML files. */
function getElement(selector) {
  return document.querySelector(selector);
}

function getElements(selector) {
  return [...document.querySelectorAll(selector)];
}

/* TEXT HYGIENE: Removes emoji and decorative glyphs before anything is shown in the UI. */
function stripSiteEmoji(value = "") {
  return String(value)
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value = "") {
  return stripSiteEmoji(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function courseAnchor(code) {
  return code.replace(/\s+/g, "-");
}

function getSelectedCourseCode() {
  return new URLSearchParams(window.location.search).get("course");
}

function getScholarDisplayName(session = getMemberSession()) {
  const names = stripSiteEmoji(session?.name || "").split(/\s+/).filter(Boolean);
  return names[1] || names[0] || "Scholar";
}

function isDashboardPage() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  return page === "index.html" || page === "dashboard.html";
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

function formatExamDate(date) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function parseClockTime(value, date) {
  const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase();

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function getTimetableWindow(item) {
  const [day, month, year] = item.date.split("/").map(Number);
  const baseDate = new Date(year, month - 1, day);
  const [startText, endText] = item.time.split("-").map((part) => part.trim());
  const start = parseClockTime(startText, baseDate);
  const end = parseClockTime(endText, baseDate);

  return { start, end };
}

function getTimetableStatus(item, now = new Date()) {
  const { start, end } = getTimetableWindow(item);
  if (!start || !end) return "upcoming";
  if (now >= end) return "passed";
  if (now >= start) return "current";
  return "upcoming";
}

function getNextTimetableItem(now = new Date()) {
  return cbtTimetable
    .map((item) => ({ ...item, ...getTimetableWindow(item) }))
    .filter((item) => item.end && item.end > now)
    .sort((a, b) => a.start - b.start)[0];
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

function isPublicMemberPage() {
  return document.body.dataset.portal !== "staff";
}

function setMemberGate(isLocked) {
  if (!isPublicMemberPage()) return;
  document.body.dataset.memberGate = isLocked ? "locked" : "open";
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

/* PUSH NOTIFICATIONS: Links OneSignal browser push to the saved student profile. */
async function connectPushNotifications(session, shouldPrompt = false, options = {}) {
  if (!session?.memberId || !window.OneSignalDeferred) return;

  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.login(session.memberId);

      if (OneSignal.User?.addTags) {
        await OneSignal.User.addTags({
          name: session.name || "",
          matricNumber: session.matricNumber || "",
        });
      }

      if (shouldPrompt && (options.forcePrompt || !localStorage.getItem(ONESIGNAL_PROMPT_KEY))) {
        localStorage.setItem(ONESIGNAL_PROMPT_KEY, "true");
        if (OneSignal.Slidedown?.promptPush) {
          await OneSignal.Slidedown.promptPush();
        }
      }
    } catch (error) {
      console.warn("OneSignal setup skipped:", error);
    }
  });
}

/* NOTIFICATION SETUP: Gives students a visible retry path for mobile push permission. */
function renderNotificationSetup() {
  const existingPanel = getElement("#notificationSetup");
  if (document.body.dataset.portal === "staff" || !isDashboardPage()) {
    existingPanel?.remove();
    return;
  }

  const controlRow = getElement(".control-row");
  const session = getMemberSession();
  if (!controlRow || !session?.memberId) return;

  if (existingPanel) return;

  const panel = document.createElement("section");
  panel.id = "notificationSetup";
  panel.className = "notification-setup";
  panel.innerHTML = `
    <div>
      <span class="material-symbols-rounded" aria-hidden="true">notifications_active</span>
      <div>
        <strong>Class notifications</strong>
        <p>Android users can allow notifications here. iPhone users should add the site to Home Screen, open it from that icon, then enable notifications.</p>
        <small id="notificationSetupStatus">You can retry setup anytime from this dashboard.</small>
      </div>
    </div>
    <button class="secondary-action" type="button" data-enable-notifications>
      <span class="material-symbols-rounded" aria-hidden="true">touch_app</span>
      Enable notifications
    </button>
  `;

  controlRow.insertAdjacentElement("afterend", panel);
}

/* FOOTER CREDIT: Keeps the creator mark present without competing with the portal UI. */
function renderSiteCredit() {
  const main = getElement(".main-area");
  if (!main || getElement(".site-credit")) return;

  const credit = document.createElement("footer");
  credit.className = "site-credit";
  credit.textContent = "Copyright 2026 Maverick";
  main.appendChild(credit);
}

/* SCHOLAR GREETING: Uses the checked-in student's second name on the dashboard only. */
function renderScholarGreeting() {
  const existingGreeting = getElement("#scholarGreeting");
  if (document.body.dataset.portal === "staff" || !isDashboardPage()) {
    existingGreeting?.remove();
    return;
  }

  const main = getElement(".main-area");
  const header = getElement(".page-header");
  const session = getMemberSession();
  if (!main || !header || !session?.name) return;

  let greeting = existingGreeting;
  if (!greeting) {
    greeting = document.createElement("section");
    greeting.id = "scholarGreeting";
    greeting.className = "scholar-greeting";
    header.insertAdjacentElement("afterend", greeting);
  }

  greeting.innerHTML = `
    <span>Welcome, Scholar <strong>${escapeHtml(getScholarDisplayName(session))}</strong></span>
  `;
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
    if (active !== false) {
      setMemberGate(false);
      connectPushNotifications(existingSession);
      return;
    }
    clearMemberSession();
  }

  setMemberGate(true);

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
      setMemberGate(false);
      renderScholarGreeting();
      renderNotificationSetup();
      showToast("Welcome. Your class profile is saved.");
      connectPushNotifications(memberSession, true);
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

function normalizeResourceGroup(resource) {
  const label = stripSiteEmoji(resource.type || "Other").toLowerCase();
  if (label.includes("past") || label.includes("pq") || label.includes("question")) return "Past Questions";
  if (label.includes("slide") || label.includes("lecture")) return "Slides";
  if (label.includes("note")) return "Notes";
  if (label.includes("assignment")) return "Assignments";
  if (label.includes("practical") || label.includes("lab")) return "Practicals";
  if (label.includes("link")) return "Links";
  return "Other Resources";
}

function courseResourceItem(resource) {
  return `
    <article class="course-resource-item">
      <div>
        <h4>${escapeHtml(resource.title)}</h4>
        <p>${escapeHtml(resource.note || resource.fileName || "Uploaded class material")}</p>
      </div>
      <a class="card-action" href="${escapeHtml(resource.downloadUrl || "#")}" target="_blank" rel="noreferrer">
        <span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>
        Open
      </a>
    </article>
  `;
}

function renderCourseDetail(grid, course, resources) {
  const grouped = resources.reduce((groups, resource) => {
    const group = normalizeResourceGroup(resource);
    groups[group] = groups[group] || [];
    groups[group].push(resource);
    return groups;
  }, {});
  const groupOrder = ["Slides", "Past Questions", "Notes", "Assignments", "Practicals", "Links", "Other Resources"];

  grid.classList.add("course-detail-grid");
  grid.innerHTML = `
    <section class="course-detail">
      <a class="back-link" href="./courses.html">
        <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        All courses
      </a>
      <div class="course-detail-head">
        <span class="course-code">${escapeHtml(course.code)}</span>
        <span class="unit-pill">${course.units} unit${course.units > 1 ? "s" : ""}</span>
        <h2>${escapeHtml(course.title)}</h2>
        <p>${escapeHtml(course.type)}. ${resources.length} posted resource${resources.length === 1 ? "" : "s"}.</p>
      </div>
      <div class="course-resource-groups">
        ${groupOrder
          .map((group) => {
            const groupItems = grouped[group] || [];
            return `
              <section class="course-resource-group">
                <div class="group-heading">
                  <h3>${group}</h3>
                  <span>${groupItems.length}</span>
                </div>
                ${
                  groupItems.length
                    ? groupItems.map(courseResourceItem).join("")
                    : `<p class="empty-group">Nothing posted here yet.</p>`
                }
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
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

  grid.classList.remove("course-detail-grid");
  const selectedCourseCode = getSelectedCourseCode();
  const selectedCourse = firstSemesterCourses.find((course) => course.code === selectedCourseCode);
  if (selectedCourse) {
    const resources = state.resources.filter((resource) => resource.courseCode === selectedCourse.code);
    if (count) count.textContent = `${selectedCourse.code} course view`;
    renderCourseDetail(grid, selectedCourse, resources);
    return;
  }

  if (count) count.textContent = `${firstSemesterCourses.length} courses`;

  grid.innerHTML = firstSemesterCourses
    .map((course) => {
      const resources = state.resources.filter((resource) => resource.courseCode === course.code);
      const latest = resources.slice(0, 3);
      return `
        <a class="course-card course-card-link" id="${courseAnchor(course.code)}" href="./courses.html?course=${encodeURIComponent(
        course.code
      )}">
          <div class="card-topline">
            <span class="course-code">${escapeHtml(course.code)}</span>
            <span class="unit-pill">${course.units} unit${course.units > 1 ? "s" : ""}</span>
          </div>
          <div>
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.type)}. ${resources.length} posted resource${resources.length === 1 ? "" : "s"}.</p>
          </div>
          <div class="mini-resource-list">
            ${
              latest.length
                ? latest
                    .map(
                      (resource) =>
                        `<span>${escapeHtml(resource.title)}</span>`
                    )
                    .join("")
                : "<span>No resources yet</span>"
            }
          </div>
        </a>
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
        <tr data-status="${getTimetableStatus(item)}">
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

/* NEXT CBT CARD: Automatically advances after each exam time passes. */
function renderNextExam() {
  const title = getElement("#nextExamTitle");
  const meta = getElement("#nextExamMeta");
  if (!title || !meta) return;

  const now = new Date();
  const next = getNextTimetableItem(now);
  if (!next) {
    title.textContent = "CBT complete";
    meta.textContent = "All listed timetable rows have passed.";
    return;
  }

  const isCurrent = now >= next.start && now < next.end;
  title.textContent = next.course;
  meta.textContent = isCurrent
    ? `Now until ${next.time.split("-")[1].trim()} - ${next.batch}`
    : `${formatExamDate(next.start)} - ${next.time} - ${next.batch}`;
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

function canEditResource(resource) {
  return canDeleteResource(resource);
}

function canEditAnnouncement(announcement) {
  return canDeleteAnnouncement(announcement);
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
              ? `<div class="table-actions">
                  <button class="ghost-link" data-edit-resource="${resource.id}">Edit</button>
                  <button class="danger-link" data-delete-resource="${resource.id}">Delete</button>
                </div>`
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
              ? `<div class="table-actions">
                  <button class="ghost-link" data-edit-announcement="${announcement.id}">Edit</button>
                  <button class="danger-link" data-delete-announcement="${announcement.id}">Delete</button>
                </div>`
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
                <td>
                  <button class="ghost-link suggestion-preview" data-view-suggestion="${suggestion.id}">
                    ${escapeHtml(suggestion.message)}
                  </button>
                </td>
                <td>${formatDate(suggestion.createdAtMs)}</td>
                <td>
                  <div class="table-actions">
                    <button class="ghost-link" data-view-suggestion="${suggestion.id}">View</button>
                    ${
                      isAdminPortal()
                        ? `<button class="danger-link" data-delete-suggestion="${suggestion.id}">Delete</button>`
                        : `<span class="muted-cell">Visible</span>`
                    }
                  </div>
                </td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5">No suggestions yet.</td></tr>`;
  }
}

function renderAll() {
  renderSiteCredit();
  renderScholarGreeting();
  renderNotificationSetup();
  renderSidebarCourses();
  renderDashboardMetrics();
  renderResourceCards();
  renderCourseGrid();
  renderTimetable();
  renderNextExam();
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

function normalizeUploadName(value = "") {
  return stripSiteEmoji(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+\(\d+\)(?=\.[a-z0-9]+$)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCosBulkMetadata(fileName) {
  const normalized = normalizeUploadName(fileName);
  return cosBulkMetadata.find((item) => item.keys.some((key) => normalized.includes(key)));
}

function renderBulkUploadLine(target, text, tone = "default") {
  if (!target) return;
  const item = document.createElement("li");
  item.dataset.tone = tone;
  item.textContent = text;
  target.appendChild(item);
}

function ensureAiDetailsButton(uploadForm, uploadStatus) {
  if (!uploadForm) return null;
  const existingButton = uploadForm.querySelector("[data-generate-resource-details]");
  if (existingButton) return existingButton;

  const button = document.createElement("button");
  button.className = "secondary-action ai-details-button";
  button.type = "button";
  button.dataset.generateResourceDetails = "true";
  button.innerHTML = `
    <span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>
    Auto-title
  `;

  const fileLabel = uploadForm.querySelector('input[name="file"]')?.closest("label");
  if (fileLabel) {
    fileLabel.insertAdjacentElement("afterend", button);
  } else {
    uploadForm.insertBefore(button, uploadStatus || uploadForm.lastElementChild);
  }

  return button;
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
    const autoTitleButton = ensureAiDetailsButton(uploadForm, uploadStatus);

    if (autoTitleButton) {
      autoTitleButton.addEventListener("click", async () => {
        const formData = new FormData(uploadForm);
        const file = formData.get("file");
        const course = findCourse(String(formData.get("courseCode")));

        if (!(file instanceof File) || !file.name) {
          uploadStatus.textContent = "Choose a file first, then use Auto-title.";
          return;
        }

        autoTitleButton.disabled = true;
        uploadStatus.textContent = "Generating title and context...";

        try {
          const details = await state.backend.generateResourceDetails({
            courseCode: String(formData.get("courseCode")),
            courseTitle: course?.title || "",
            fileName: file.name,
            existingTitle: String(formData.get("title") || ""),
            existingNote: String(formData.get("note") || ""),
          });

          uploadForm.elements.title.value = details.title || uploadForm.elements.title.value;
          uploadForm.elements.note.value = details.context || uploadForm.elements.note.value;
          if (details.type && [...uploadForm.elements.type.options].some((option) => option.value === details.type)) {
            uploadForm.elements.type.value = details.type;
          }

          uploadStatus.textContent = "Auto-title filled. Review before uploading.";
        } catch (error) {
          uploadStatus.textContent = error.message || "Auto-title failed.";
        } finally {
          autoTitleButton.disabled = false;
        }
      });
    }

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

/* TEMP BULK UPLOAD: Staff-only helper for quickly loading the COS 101 batch. */
function connectCosBulkUpload() {
  const form = getElement("#cosBulkUploadForm");
  const fileInput = getElement("#cosBulkFiles");
  const status = getElement("#cosBulkStatus");
  const list = getElement("#cosBulkList");
  if (!form || !fileInput) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = [...fileInput.files];
    const course = findCourse("COS 101");
    const seenTitles = new Set();
    let uploadedCount = 0;
    let skippedCount = 0;

    if (!files.length) {
      status.textContent = "Choose the COS files first.";
      return;
    }

    list.innerHTML = "";
    status.textContent = "Preparing COS uploads...";

    for (const file of files) {
      const metadata = findCosBulkMetadata(file.name);

      if (!metadata) {
        skippedCount += 1;
        renderBulkUploadLine(list, `Skipped unknown file: ${stripSiteEmoji(file.name)}`, "muted");
        continue;
      }

      if (seenTitles.has(metadata.title)) {
        skippedCount += 1;
        renderBulkUploadLine(list, `Skipped duplicate copy: ${metadata.title}`, "muted");
        continue;
      }

      if (state.resources.some((resource) => resource.courseCode === "COS 101" && resource.title === metadata.title)) {
        seenTitles.add(metadata.title);
        skippedCount += 1;
        renderBulkUploadLine(list, `Already on portal: ${metadata.title}`, "muted");
        continue;
      }

      seenTitles.add(metadata.title);
      status.textContent = `Uploading ${metadata.title}...`;

      try {
        await state.backend.uploadResource(
          {
            title: metadata.title,
            courseCode: "COS 101",
            courseTitle: course?.title || "Introduction to Computing Sciences",
            type: metadata.type,
            note: metadata.note,
          },
          file,
          (progress) => {
            status.textContent = `Uploading ${metadata.title}... ${progress}%`;
          }
        );
        uploadedCount += 1;
        renderBulkUploadLine(list, `Uploaded: ${metadata.title}`, "success");
      } catch (error) {
        renderBulkUploadLine(list, `${metadata.title}: ${error.message || "Upload failed."}`, "error");
      }
    }

    status.textContent = `COS batch complete. ${uploadedCount} uploaded, ${skippedCount} skipped.`;
    form.reset();
  });
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

/* EDIT MODALS: Lets staff correct titles, contexts, filenames, and announcements after posting. */
function closeEditModal() {
  getElement("#editPostModal")?.remove();
}

function openEditResourceModal(resource) {
  if (!resource || !canEditResource(resource)) return;

  closeEditModal();
  const overlay = document.createElement("section");
  overlay.className = "edit-modal";
  overlay.id = "editPostModal";
  overlay.innerHTML = `
    <form class="edit-card" id="editResourceForm">
      <div class="edit-card-head">
        <div>
          <p class="eyebrow">Edit resource</p>
          <h2>${escapeHtml(resource.courseCode)}</h2>
        </div>
        <button type="button" class="icon-button" data-close-edit aria-label="Close editor">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
      <label>
        Title
        <input name="title" type="text" value="${escapeHtml(resource.title)}" required />
      </label>
      <label>
        Category
        <select name="type">
          ${resourceTypes
            .map(
              (type) =>
                `<option value="${escapeHtml(type)}" ${type === resource.type ? "selected" : ""}>${escapeHtml(
                  type
                )}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>
        Context
        <textarea name="note" rows="4">${escapeHtml(resource.note || "")}</textarea>
      </label>
      <label>
        Display file name
        <input name="fileName" type="text" value="${escapeHtml(resource.fileName || "")}" required />
      </label>
      <button class="primary-action" type="submit">Save changes</button>
      <p class="form-status" id="editResourceStatus"></p>
    </form>
  `;
  document.body.appendChild(overlay);

  getElement("[data-close-edit]")?.addEventListener("click", closeEditModal);
  getElement("#editResourceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = getElement("#editResourceStatus");
    const formData = new FormData(event.currentTarget);
    try {
      status.textContent = "Saving changes...";
      await state.backend.updateResource(resource.id, {
        title: String(formData.get("title")).trim(),
        type: String(formData.get("type")),
        note: String(formData.get("note")).trim(),
        fileName: String(formData.get("fileName")).trim(),
      });
      closeEditModal();
      showToast("Resource updated.");
    } catch (error) {
      status.textContent = error.message || "Could not update resource.";
    }
  });
}

function openEditAnnouncementModal(announcement) {
  if (!announcement || !canEditAnnouncement(announcement)) return;

  closeEditModal();
  const overlay = document.createElement("section");
  overlay.className = "edit-modal";
  overlay.id = "editPostModal";
  overlay.innerHTML = `
    <form class="edit-card" id="editAnnouncementForm">
      <div class="edit-card-head">
        <div>
          <p class="eyebrow">Edit announcement</p>
          <h2>Portal notice</h2>
        </div>
        <button type="button" class="icon-button" data-close-edit aria-label="Close editor">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
      <label>
        Title
        <input name="title" type="text" value="${escapeHtml(announcement.title)}" required />
      </label>
      <label>
        Priority
        <select name="priority">
          ${["Normal", "Important", "Urgent"]
            .map(
              (priority) =>
                `<option value="${priority}" ${priority === announcement.priority ? "selected" : ""}>${priority}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>
        Message
        <textarea name="message" rows="5" required>${escapeHtml(announcement.message)}</textarea>
      </label>
      <button class="primary-action" type="submit">Save changes</button>
      <p class="form-status" id="editAnnouncementStatus"></p>
    </form>
  `;
  document.body.appendChild(overlay);

  getElement("[data-close-edit]")?.addEventListener("click", closeEditModal);
  getElement("#editAnnouncementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = getElement("#editAnnouncementStatus");
    const formData = new FormData(event.currentTarget);
    try {
      status.textContent = "Saving changes...";
      await state.backend.updateAnnouncement(announcement.id, {
        title: String(formData.get("title")).trim(),
        priority: String(formData.get("priority")),
        message: String(formData.get("message")).trim(),
      });
      closeEditModal();
      showToast("Announcement updated.");
    } catch (error) {
      status.textContent = error.message || "Could not update announcement.";
    }
  });
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 12) {
  const words = stripSiteEmoji(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((item, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    context.fillText(`${item}${suffix}`, x, y + index * lineHeight);
  });
}

function downloadSuggestionImage(suggestion) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 1200, 900);
  gradient.addColorStop(0, "#fffdf8");
  gradient.addColorStop(0.45, "#e6f6ef");
  gradient.addColorStop(1, "#f2eadb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 900);

  context.fillStyle = "rgba(42, 157, 127, 0.16)";
  context.beginPath();
  context.ellipse(965, 135, 270, 145, -0.25, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(217, 111, 77, 0.14)";
  context.beginPath();
  context.ellipse(130, 790, 310, 170, 0.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 253, 248, 0.92)";
  context.strokeStyle = "rgba(23, 27, 31, 0.1)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(90, 90, 1020, 720, 34);
  context.fill();
  context.stroke();

  context.fillStyle = "#16735c";
  context.font = "600 32px Inter, Arial, sans-serif";
  context.fillText("PhysioK29 Suggestion", 140, 165);

  context.fillStyle = "#d96f4d";
  context.font = "600 24px Inter, Arial, sans-serif";
  context.fillText(stripSiteEmoji(suggestion.category || "General").toUpperCase(), 140, 220);

  context.fillStyle = "#171b1f";
  context.font = "600 42px Outfit, Inter, Arial, sans-serif";
  wrapCanvasText(context, suggestion.message, 140, 305, 910, 54, 9);

  context.fillStyle = "#67706c";
  context.font = "400 24px Inter, Arial, sans-serif";
  context.fillText(`From: ${stripSiteEmoji(suggestion.name)}`, 140, 720);
  context.fillText(`Matric: ${stripSiteEmoji(suggestion.matricNumber)}`, 140, 758);
  context.fillText(`Sent: ${formatDate(suggestion.createdAtMs)}`, 760, 758);

  context.fillStyle = "rgba(23, 27, 31, 0.45)";
  context.font = "400 18px Inter, Arial, sans-serif";
  context.fillText("Generated from PhysioK29 staff portal", 140, 845);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `physiok29-suggestion-${stripSiteEmoji(suggestion.matricNumber || "student")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openSuggestionModal(suggestion) {
  if (!suggestion) return;

  closeEditModal();
  const overlay = document.createElement("section");
  overlay.className = "edit-modal";
  overlay.id = "editPostModal";
  overlay.innerHTML = `
    <article class="edit-card suggestion-detail-card">
      <div class="edit-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(suggestion.category || "General")}</p>
          <h2>${escapeHtml(suggestion.name)}</h2>
        </div>
        <button type="button" class="icon-button" data-close-edit aria-label="Close suggestion">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
      <div class="suggestion-art-card">
        <p>${escapeHtml(suggestion.message)}</p>
        <div>
          <span>${escapeHtml(suggestion.matricNumber)}</span>
          <span>${formatDate(suggestion.createdAtMs)}</span>
        </div>
      </div>
      <button class="primary-action" type="button" data-download-suggestion="${suggestion.id}">
        <span class="material-symbols-rounded" aria-hidden="true">download</span>
        Download as image
      </button>
    </article>
  `;
  document.body.appendChild(overlay);

  getElement("[data-close-edit]")?.addEventListener("click", closeEditModal);
  getElement("[data-download-suggestion]")?.addEventListener("click", () => downloadSuggestionImage(suggestion));
}

/* STAFF ACTIONS: Deletes resources, announcements, suggestions, and member records. */
function connectStaffActions() {
  document.addEventListener("click", async (event) => {
    const editResourceButton = event.target.closest("[data-edit-resource]");
    const editAnnouncementButton = event.target.closest("[data-edit-announcement]");
    const viewSuggestionButton = event.target.closest("[data-view-suggestion]");
    const resourceButton = event.target.closest("[data-delete-resource]");
    const announcementButton = event.target.closest("[data-delete-announcement]");
    const suggestionButton = event.target.closest("[data-delete-suggestion]");
    const memberButton = event.target.closest("[data-delete-member]");

    try {
      if (editResourceButton) {
        const resource = state.resources.find((item) => item.id === editResourceButton.dataset.editResource);
        openEditResourceModal(resource);
        return;
      }

      if (editAnnouncementButton) {
        const announcement = state.announcements.find(
          (item) => item.id === editAnnouncementButton.dataset.editAnnouncement
        );
        openEditAnnouncementModal(announcement);
        return;
      }

      if (viewSuggestionButton) {
        const suggestion = state.suggestions.find((item) => item.id === viewSuggestionButton.dataset.viewSuggestion);
        openSuggestionModal(suggestion);
        return;
      }

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

/* NOTIFICATION BUTTON: Lets students retry OneSignal permission setup from the dashboard. */
function connectNotificationSetup() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-enable-notifications]");
    if (!button) return;

    const status = getElement("#notificationSetupStatus");
    const session = getMemberSession();
    if (!session?.memberId) {
      if (status) status.textContent = "Complete class check-in before enabling notifications.";
      return;
    }

    button.disabled = true;
    if (status) status.textContent = "Opening the browser notification prompt...";

    try {
      localStorage.removeItem(ONESIGNAL_PROMPT_KEY);
      await connectPushNotifications(session, true, { forcePrompt: true });
      if (status) {
        status.textContent = "If your browser allows web push, notifications are now linked to this device.";
      }
    } catch (error) {
      if (status) status.textContent = error.message || "Notification setup could not finish on this browser.";
    } finally {
      button.disabled = false;
    }
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
  setMemberGate(!getMemberSession()?.memberId);
  populateCourseSelects();
  renderAll();
  connectSearch();
  connectStaffPortal(document.body.dataset.portalRole === "admin" ? ["admin"] : ["rep", "admin"]);
  connectRepForms();
  connectCosBulkUpload();
  connectSuggestionForm();
  connectStaffActions();
  connectCopyButtons();
  connectNotificationSetup();
  connectTimetableDownload();
  connectRealtimeData();
  window.setInterval(renderNextExam, 60000);
  await ensureMemberOnboarding();
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "The portal could not start.", "error");
});
