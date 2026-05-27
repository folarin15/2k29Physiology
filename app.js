import { cbtTimetable, findCourse, firstSemesterCourses, resourceTypes } from "./data.js?v=20260527c";
import { createBackend } from "./supabase-service.js?v=20260527c";
import { isSupabaseConfigured } from "./supabase-config.js?v=20260527c";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const MEMBER_SESSION_COOKIE = "physiok29_member_session";
const ONESIGNAL_PROMPT_KEY = "physiology2k29.onesignalPromptAsked";
const NOTIFICATION_READ_KEY = "physiology2k29.readNotifications";
const NOTIFICATION_COLLAPSED_KEY = "physiology2k29.notificationCenterCollapsed";
const BULK_ALLOWED_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);

const state = {
  backend: null,
  resources: [],
  announcements: [],
  members: [],
  suggestions: [],
  resourceProgress: [],
  resourceFeedback: [],
  staffUser: null,
  staffRole: null,
  realtimeUnsubscribe: null,
  membersUnsubscribe: null,
  suggestionsUnsubscribe: null,
  engagementUnsubscribe: null,
  push: {
    checked: false,
    subscribed: false,
    subscriptionId: "",
  },
  pushListenerAttached: false,
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

function resourceReaderLink(resource) {
  return resource?.id ? `./reader.html?resource=${encodeURIComponent(resource.id)}` : resource?.downloadUrl || "#";
}

function getResourceProgress(resource) {
  return (
    resource?.progress ||
    state.resourceProgress.find((progress) => progress?.resourceId === resource?.id) ||
    null
  );
}

function getResourceFeedback(resource) {
  const helpfulCount =
    resource?.feedback?.helpfulCount ??
    state.resourceFeedback.filter((feedback) => feedback?.resourceId === resource?.id && feedback.helpful).length;

  return {
    helpful: Boolean(resource?.feedback?.helpful),
    helpfulCount: Number(helpfulCount || 0),
  };
}

function setResourceProgress(resourceId, progress) {
  if (!resourceId || !progress) return;
  state.resources = state.resources.map((resource) =>
    resource.id === resourceId ? { ...resource, progress } : resource
  );
  state.resourceProgress = [
    progress,
    ...state.resourceProgress.filter((item) => item?.resourceId !== resourceId || item?.memberId !== progress.memberId),
  ];
}

function setResourceFeedback(resourceId, feedback) {
  if (!resourceId || !feedback) return;
  state.resources = state.resources.map((resource) =>
    resource.id === resourceId ? { ...resource, feedback } : resource
  );
}

function progressLabel(status = "opened") {
  return (
    {
      "not-started": "Not started",
      opened: "Opened",
      reading: "Reading",
      urgent: "Urgent",
      done: "Done",
    }[status] || "Not started"
  );
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

function formatFullExamDate(date) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function getUpcomingTrackedCbtItems(now = new Date()) {
  return cbtTimetable
    .map((item) => ({ ...item, ...getTimetableWindow(item) }))
    .filter((item) => item.end && item.end > now)
    .sort((a, b) => a.start - b.start);
}

function getNextTrackedCbtItem(now = new Date()) {
  return getUpcomingTrackedCbtItems(now)[0];
}

function formatCountdownParts(targetDate, now = new Date()) {
  const totalSeconds = Math.max(0, Math.floor((targetDate - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];
}

function getReadNotificationIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveReadNotificationIds(ids) {
  localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify([...ids].slice(0, 300)));
}

function getNotificationCenterCollapsed() {
  try {
    return localStorage.getItem(NOTIFICATION_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveNotificationCenterCollapsed(isCollapsed) {
  try {
    localStorage.setItem(NOTIFICATION_COLLAPSED_KEY, String(Boolean(isCollapsed)));
  } catch {
    // The center still works when storage is unavailable.
  }
}

function getCookieValue(name) {
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function saveMemberSessionCookie(session) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${MEMBER_SESSION_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
}

function clearMemberSessionCookie() {
  document.cookie = `${MEMBER_SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getMemberSession() {
  try {
    const storedSession = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY));
    if (storedSession?.memberId) return storedSession;
  } catch {
    // Fall through to the cookie backup below.
  }

  try {
    const cookieSession = JSON.parse(decodeURIComponent(getCookieValue(MEMBER_SESSION_COOKIE) || "null"));
    if (cookieSession?.memberId) {
      localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    }
  } catch {
    // A bad cookie should not block a fresh check-in.
  }

  return null;
}

function saveMemberSession(session) {
  try {
    localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Cookie backup still keeps returning students from losing access.
  }
  saveMemberSessionCookie(session);
}

function clearMemberSession() {
  try {
    localStorage.removeItem(MEMBER_SESSION_KEY);
  } catch {
    // Ignore storage errors and clear the cookie fallback.
  }
  clearMemberSessionCookie();
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

function getPushSubscriptionState(OneSignal) {
  const subscription = OneSignal?.User?.PushSubscription;
  const subscriptionId = subscription?.id || "";
  const optedIn = Boolean(subscription?.optedIn);
  const permission = Boolean(OneSignal?.Notifications?.permission);

  return {
    checked: true,
    subscribed: Boolean(subscriptionId && optedIn),
    subscriptionId,
    permission,
  };
}

function updateSavedPushState(pushState) {
  const session = getMemberSession();
  if (!session?.memberId) return;

  saveMemberSession({
    ...session,
    notificationEnabled: pushState.subscribed,
    oneSignalSubscriptionId: pushState.subscriptionId || "",
    savedAt: Date.now(),
  });
}

async function syncPushSubscriptionState(OneSignal) {
  const pushState = getPushSubscriptionState(OneSignal);
  state.push = pushState;
  updateSavedPushState(pushState);
  renderNotificationSetup();

  const session = getMemberSession();
  if (session?.memberId && state.backend?.savePushStatus) {
    await state.backend.savePushStatus({
      memberSession: session,
      enabled: pushState.subscribed,
      subscriptionId: pushState.subscriptionId,
    });
  }

  return pushState;
}

function runOneSignal(callback) {
  if (!window.OneSignalDeferred) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await callback(OneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });
}

/* PUSH NOTIFICATIONS: Links OneSignal browser push to the saved student profile. */
async function connectPushNotifications(session, shouldPrompt = false, options = {}) {
  if (!session?.memberId || !window.OneSignalDeferred) return null;

  return runOneSignal(async (OneSignal) => {
    await OneSignal.login(session.memberId);

    if (OneSignal.User?.addTags) {
      await OneSignal.User.addTags({
        name: session.name || "",
        matricNumber: session.matricNumber || "",
      });
    }

    if (!state.pushListenerAttached && OneSignal.User?.PushSubscription?.addEventListener) {
      OneSignal.User.PushSubscription.addEventListener("change", () => {
        syncPushSubscriptionState(OneSignal).catch((error) => console.warn("Push status sync skipped:", error));
      });
      state.pushListenerAttached = true;
    }

    let pushState = await syncPushSubscriptionState(OneSignal);

    let hasPrompted = false;
    try {
      hasPrompted = Boolean(localStorage.getItem(ONESIGNAL_PROMPT_KEY));
    } catch {
      hasPrompted = false;
    }

    if (shouldPrompt && !pushState.subscribed && (options.forcePrompt || !hasPrompted)) {
      try {
        localStorage.setItem(ONESIGNAL_PROMPT_KEY, "true");
      } catch {
        // Notification prompting can still continue if storage is unavailable.
      }
      if (OneSignal.Slidedown?.promptPush) {
        await OneSignal.Slidedown.promptPush();
      } else if (OneSignal.User?.PushSubscription?.optIn) {
        await OneSignal.User.PushSubscription.optIn();
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      pushState = await syncPushSubscriptionState(OneSignal);
    }

    return pushState;
  }).catch((error) => {
    console.warn("OneSignal setup skipped:", error);
    return null;
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

  if (state.push.subscribed || session.notificationEnabled) {
    existingPanel?.remove();
    return;
  }

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

/* STUDENT ONBOARDING: Collects name and matric once, then refreshes the member record. */
async function ensureMemberOnboarding() {
  if (document.body.dataset.portal === "staff") return true;

  if (shouldResetMemberSession()) {
    clearMemberSession();
  }

  const existingSession = getMemberSession();
  if (existingSession?.memberId) {
    const refreshedSession = await state.backend.refreshMemberSession(existingSession).catch(() => null);
    if (refreshedSession && refreshedSession.ok !== false) {
      saveMemberSession({
        ...existingSession,
        ...refreshedSession,
        memberId: existingSession.memberId,
        savedAt: Date.now(),
      });
      setMemberGate(false);
      connectPushNotifications(getMemberSession());
      return true;
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
        name: session.name || profile.name,
        matricNumber: session.matricNumber || profile.matricNumber,
        savedAt: Date.now(),
      };
      saveMemberSession(memberSession);

      overlay.remove();
      setMemberGate(false);
      renderScholarGreeting();
      renderNotificationSetup();
      showToast("Welcome. Your class profile is saved.");
      connectPushNotifications(memberSession, true);
      startPublicRealtimeData();
    } catch (error) {
      status.textContent = error.message || "Could not save profile. Please try again.";
    }
  });

  return false;
}

/* METRICS COMPONENT: Combines fixed course counts with live backend records. */
function renderDashboardMetrics() {
  const courseCount = getElement("#courseCount");
  const resourceCount = getElement("#resourceCount");
  const timetableCount = getElement("#timetableCount");

  if (courseCount) courseCount.textContent = firstSemesterCourses.length;
  if (resourceCount) resourceCount.textContent = state.resources.length;
  if (timetableCount) timetableCount.textContent = cbtTimetable.length;
}

function progressBadge(resource) {
  const status = getResourceProgress(resource)?.status || "not-started";
  return `<span class="progress-pill" data-status="${escapeHtml(status)}">${progressLabel(status)}</span>`;
}

function resourceEngagementRow(resource) {
  const progress = getResourceProgress(resource);
  const feedback = getResourceFeedback(resource);
  const activeStatus = progress?.status || "";

  return `
    <div class="resource-engagement">
      ${progressBadge(resource)}
      <button class="mini-action" type="button" data-progress-resource="${escapeHtml(resource.id)}" data-progress-status="reading" data-active="${activeStatus === "reading"}">
        <span class="material-symbols-rounded" aria-hidden="true">local_library</span>
        Reading
      </button>
      <button class="mini-action" type="button" data-progress-resource="${escapeHtml(resource.id)}" data-progress-status="urgent" data-active="${activeStatus === "urgent"}">
        <span class="material-symbols-rounded" aria-hidden="true">priority_high</span>
        Urgent
      </button>
      <button class="mini-action" type="button" data-progress-resource="${escapeHtml(resource.id)}" data-progress-status="done" data-active="${activeStatus === "done"}">
        <span class="material-symbols-rounded" aria-hidden="true">task_alt</span>
        Done
      </button>
      <button class="mini-action helpful-action" type="button" data-helpful-resource="${escapeHtml(resource.id)}" data-active="${feedback.helpful}">
        <span class="material-symbols-rounded" aria-hidden="true">thumb_up</span>
        Helpful ${feedback.helpfulCount}
      </button>
    </div>
  `;
}

function resourceCard(resource) {
  const resourceUrl = resourceReaderLink(resource);

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
      ${resourceEngagementRow(resource)}
      <a class="card-action" href="${escapeHtml(resourceUrl)}">
        <span class="material-symbols-rounded" aria-hidden="true">chrome_reader_mode</span>
        Read inside
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
  const resourceUrl = resourceReaderLink(resource);
  return `
    <article class="course-resource-item">
      <div>
        <h4>${escapeHtml(resource.title)}</h4>
        <p>${escapeHtml(resource.note || resource.fileName || "Uploaded class material")}</p>
        ${resourceEngagementRow(resource)}
      </div>
      <a class="card-action" href="${escapeHtml(resourceUrl)}">
        <span class="material-symbols-rounded" aria-hidden="true">chrome_reader_mode</span>
        Read
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
        <div class="course-detail-actions">
          <button class="secondary-action" type="button" data-download-course-zip="${escapeHtml(course.code)}" ${
            resources.length ? "" : "disabled"
          }>
            <span class="material-symbols-rounded" aria-hidden="true">folder_zip</span>
            Download all as ZIP
          </button>
          <span class="form-status" id="courseZipStatus"></span>
        </div>
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

/* GES/GST COUNTDOWN: Keeps the nearest matching CBT row visible and advances after each batch. */
function renderGesCountdown() {
  const title = getElement("#gesCountdownTitle");
  const meta = getElement("#gesCountdownMeta");
  const grid = getElement("#gesCountdownGrid");
  if (!title || !meta || !grid) return;

  const now = new Date();
  const next = getNextTrackedCbtItem(now);
  if (!next) {
    title.textContent = "CBT complete";
    meta.textContent = "All listed exam rows have passed.";
    grid.innerHTML = ["Days", "Hours", "Minutes", "Seconds"]
      .map((label) => `<span><strong>0</strong><small>${label}</small></span>`)
      .join("");
    return;
  }

  const isCurrent = now >= next.start && now < next.end;
  const target = isCurrent ? next.end : next.start;
  const upcomingCount = getUpcomingTrackedCbtItems(now).length;
  title.textContent = `${next.course} ${next.batch}`;
  meta.textContent = isCurrent
    ? `In progress now. Ends ${next.time.split("-")[1].trim()}. ${upcomingCount} row${upcomingCount === 1 ? "" : "s"} still active.`
    : `${formatFullExamDate(next.start)}. ${upcomingCount} row${upcomingCount === 1 ? "" : "s"} still upcoming.`;
  grid.innerHTML = formatCountdownParts(target, now)
    .map(
      (part) => `
        <span>
          <strong>${String(part.value).padStart(2, "0")}</strong>
          <small>${part.label}</small>
        </span>
      `
    )
    .join("");
}

function isLastMinuteResource(resource) {
  const haystack = `${resource.title} ${resource.type} ${resource.note || ""} ${resource.fileName || ""}`.toLowerCase();
  return /\b(past questions?|pq|pqs|mock|test|exam|ca|practice|revision|solved|compiled)\b/.test(haystack);
}

function getLastMinuteResources(limit = 10) {
  return state.resources
    .filter(isLastMinuteResource)
    .sort((a, b) => {
      const aUrgent = getResourceProgress(a)?.status === "urgent" ? 1 : 0;
      const bUrgent = getResourceProgress(b)?.status === "urgent" ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
    })
    .slice(0, limit);
}

function renderExamMode() {
  const title = getElement("#examCountdownTitle");
  const meta = getElement("#examCountdownMeta");
  const grid = getElement("#examCountdownGrid");
  const body = getElement("#examTimetableBody");
  const resources = getElement("#examResourceGrid");
  if (!title || !meta || !grid || !body || !resources) return;

  const now = new Date();
  const next = getNextTrackedCbtItem(now);
  if (!next) {
    title.textContent = "CBT complete";
    meta.textContent = "All listed GES/GST rows have passed.";
    grid.innerHTML = ["Days", "Hours", "Minutes", "Seconds"]
      .map((label) => `<span><strong>0</strong><small>${label}</small></span>`)
      .join("");
  } else {
    const isCurrent = now >= next.start && now < next.end;
    const target = isCurrent ? next.end : next.start;
    title.textContent = `${next.course} ${next.batch}`;
    meta.textContent = isCurrent ? `In progress now. Ends ${next.time.split("-")[1].trim()}.` : formatFullExamDate(next.start);
    grid.innerHTML = formatCountdownParts(target, now)
      .map(
        (part) => `
          <span>
            <strong>${String(part.value).padStart(2, "0")}</strong>
            <small>${part.label}</small>
          </span>
        `
      )
      .join("");
  }

  body.innerHTML = getUpcomingTrackedCbtItems(now)
    .map(
      (item) => `
        <tr data-status="${getTimetableStatus(item, now)}">
          <td>${item.course}</td>
          <td>${item.date}</td>
          <td>${item.batch}</td>
          <td>${item.time}</td>
        </tr>
      `
    )
    .join("");

  const lastMinute = getLastMinuteResources();
  resources.innerHTML = lastMinute.length
    ? lastMinute.map(resourceCard).join("")
    : `<article class="resource-card setup-card">
        <span class="course-code">No revision picks yet</span>
        <div>
          <h3>Last-minute resources will appear here</h3>
          <p>Past questions, mocks, tests, solved material, and revision files will show in this focused exam view.</p>
        </div>
        <a class="card-action" href="./courses.html">Browse all courses</a>
      </article>`;
}

function getNotificationItems() {
  const resourceItems = state.resources.map((resource) => ({
    id: `resource:${resource.id}`,
    kind: resource.type || "Resource",
    title: resource.title,
    message: `${resource.courseCode} material posted by ${resource.uploadedBy || "Course rep"}.`,
    time: resource.createdAtMs,
    href: resourceReaderLink(resource),
    action: "Read",
  }));
  const announcementItems = state.announcements.map((announcement) => ({
    id: `announcement:${announcement.id}`,
    kind: announcement.priority || "Announcement",
    title: announcement.title,
    message: announcement.message,
    time: announcement.createdAtMs,
    href: "./dashboard.html",
    action: "View",
  }));

  return [...announcementItems, ...resourceItems]
    .filter((item) => item.id && item.time)
    .sort((a, b) => b.time - a.time);
}

/* NOTIFICATION CENTER: In-site history for announcements and uploads. */
function renderNotificationCenter() {
  const center = getElement(".notification-center");
  const list = getElement("#notificationCenterList");
  const summary = getElement("#notificationSummary");
  const toggleButton = getElement("#markNotificationsRead");
  if (!list || !summary) return;

  const items = getNotificationItems();
  const readIds = getReadNotificationIds();
  const unreadCount = items.filter((item) => !readIds.has(item.id)).length;
  const isCompact = Boolean(items.length && unreadCount === 0 && getNotificationCenterCollapsed());

  if (unreadCount > 0) saveNotificationCenterCollapsed(false);
  if (center) center.dataset.compact = isCompact ? "true" : "false";
  if (toggleButton) {
    toggleButton.textContent = isCompact ? "View updates" : "Mark all read";
    toggleButton.disabled = !items.length;
  }

  summary.innerHTML = `
    <span><strong>${unreadCount}</strong> unread</span>
    <span>${items.length} total updates</span>
  `;

  if (!items.length) {
    list.innerHTML = `<article class="notification-item"><p>No updates yet. New uploads and announcements will appear here.</p></article>`;
    return;
  }

  if (isCompact) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = items
    .slice(0, 12)
    .map(
      (item) => `
        <article class="notification-item" data-unread="${readIds.has(item.id) ? "false" : "true"}">
          <div>
            <span>${escapeHtml(item.kind)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.message)}</p>
            <small>${formatDate(item.time)}</small>
          </div>
          <a class="card-action" href="${escapeHtml(item.href)}" ${item.href.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>
            ${escapeHtml(item.action)}
          </a>
        </article>
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
  const subscribedMembers = state.members.filter((member) => member.notificationEnabled).length;
  if (count) count.textContent = `${state.members.length} members, ${subscribedMembers} with push`;

  body.innerHTML = state.members.length
    ? state.members
        .map(
          (member) => `
            <tr>
              <td>${escapeHtml(member.name)}</td>
              <td>${escapeHtml(member.matricNumber)}</td>
              <td>
                <div class="member-status">
                  <span class="status-pill" data-tone="${member.notificationEnabled ? "success" : "muted"}">
                    ${member.notificationEnabled ? "Push on" : "Push off"}
                  </span>
                  <small>${member.notificationUpdatedAtMs ? formatDate(member.notificationUpdatedAtMs) : "Not synced yet"}</small>
                </div>
              </td>
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

function renderStaffSummary() {
  const grid = getElement("#staffSummaryGrid");
  if (!grid) return;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const uploadsThisWeek = state.resources.filter((resource) => Number(resource.createdAtMs || 0) >= weekAgo).length;
  const pushOff = state.members.filter((member) => !member.notificationEnabled).length;
  const helpfulVotes = state.resourceFeedback.filter((feedback) => feedback.helpful).length;
  const courseOpens = state.resourceProgress.reduce((courses, progress) => {
    const resource = state.resources.find((item) => item.id === progress.resourceId);
    if (!resource?.courseCode) return courses;
    courses.set(resource.courseCode, (courses.get(resource.courseCode) || 0) + Number(progress.openedCount || 0));
    return courses;
  }, new Map());
  const mostOpenedCourse = [...courseOpens.entries()].sort((a, b) => b[1] - a[1])[0];

  grid.innerHTML = `
    <article class="metric-card staff-summary-card">
      <span>${uploadsThisWeek}</span>
      <small>uploads this week</small>
    </article>
    <article class="metric-card staff-summary-card">
      <span>${mostOpenedCourse ? escapeHtml(mostOpenedCourse[0]) : "None"}</span>
      <small>${mostOpenedCourse ? `${mostOpenedCourse[1]} reader open${mostOpenedCourse[1] === 1 ? "" : "s"}` : "most opened course"}</small>
    </article>
    <article class="metric-card staff-summary-card">
      <span>${pushOff}</span>
      <small>students with push off</small>
    </article>
    <article class="metric-card staff-summary-card">
      <span>${helpfulVotes}</span>
      <small>helpful resource votes</small>
    </article>
  `;
}

function renderAll() {
  renderSiteCredit();
  renderScholarGreeting();
  renderNotificationSetup();
  renderDashboardMetrics();
  renderResourceCards();
  renderCourseGrid();
  renderTimetable();
  renderNextExam();
  renderGesCountdown();
  renderExamMode();
  renderNotificationCenter();
  renderAnnouncements();
  renderMembersTable();
  renderStaffLists();
  renderStaffSummary();
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

function renderBulkUploadLine(target, text, tone = "default") {
  if (!target) return;
  const item = document.createElement("li");
  item.dataset.tone = tone;
  item.textContent = text;
  target.appendChild(item);
}

function titleCaseResourceName(value = "") {
  return stripSiteEmoji(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function getBulkPath(file) {
  return file.bulkPath || file.webkitRelativePath || file.name || "";
}

function getFileExtension(fileName = "") {
  const match = String(fileName).toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function getMimeType(fileName = "") {
  const extension = getFileExtension(fileName);
  const types = {
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return types[extension] || "application/octet-stream";
}

function inferBulkCourse(file) {
  const path = `${getBulkPath(file)}/${file.name}`.toUpperCase().replaceAll("1O1", "101");
  return firstSemesterCourses.find((course) => path.includes(course.code));
}

function inferBulkType(file) {
  const path = `${getBulkPath(file)}/${file.name}`.toLowerCase();
  if (/\b(past questions?|pqs?|pq|test|ca|mock|exam|questions?)\b/.test(path)) return "Past Question";
  if (/\b(textbook|manual|green book|engineering math)\b/.test(path)) return "Textbook";
  if (/\b(practical|drawings?|microscopy)\b/.test(path)) return "Practical";
  return "Slide";
}

function buildBulkMetadata(file) {
  const course = inferBulkCourse(file);
  const type = inferBulkType(file);
  const readableName = titleCaseResourceName(file.name);
  const contextByType = {
    "Past Question": "Past question and revision material for exam practice.",
    Textbook: "Reference textbook or manual for deeper study.",
    Practical: "Practical support material for lab preparation and revision.",
    Slide: "Lecture slide or class material for topic review.",
  };

  return {
    course,
    type,
    title: course ? `${course.code}: ${readableName}` : readableName,
    note: `${contextByType[type] || "Class resource material."} Focus: ${readableName}.`,
  };
}

async function loadZipLibrary() {
  if (window.fflate?.unzipSync) return window.fflate;
  return import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js");
}

function normalizedDuplicateText(value = "") {
  return stripSiteEmoji(value)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findPossibleDuplicate({ courseCode, title, file }) {
  const fileName = file instanceof File ? file.name : "";
  const titleKey = normalizedDuplicateText(title);
  const fileKey = normalizedDuplicateText(fileName);
  const fileSize = file instanceof File ? file.size : 0;

  return state.resources.find((resource) => {
    if (resource.courseCode !== courseCode) return false;
    const resourceTitle = normalizedDuplicateText(resource.title);
    const resourceFile = normalizedDuplicateText(resource.fileName);
    const sameName = fileKey && (fileKey === resourceFile || fileKey === resourceTitle);
    const sameTitle = titleKey && titleKey === resourceTitle;
    const sameSize = fileSize && resource.fileSize && Number(resource.fileSize) === fileSize;
    return sameName || sameTitle || (sameSize && fileKey && resourceFile.includes(fileKey.slice(0, 18)));
  });
}

function safeZipEntryName(value = "resource") {
  return stripSiteEmoji(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "resource";
}

function uniqueZipName(used, name) {
  const safeName = safeZipEntryName(name);
  if (!used.has(safeName)) {
    used.add(safeName);
    return safeName;
  }

  const extensionMatch = safeName.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] || "";
  const base = extension ? safeName.slice(0, -extension.length) : safeName;
  let counter = 2;
  while (used.has(`${base} (${counter})${extension}`)) counter += 1;
  const uniqueName = `${base} (${counter})${extension}`;
  used.add(uniqueName);
  return uniqueName;
}

async function downloadCourseZip(courseCode) {
  const course = findCourse(courseCode);
  const resources = state.resources.filter((resource) => resource.courseCode === courseCode && resource.downloadUrl);
  const status = getElement("#courseZipStatus");

  if (!resources.length) {
    if (status) status.textContent = "No downloadable resources for this course yet.";
    return;
  }

  if (status) status.textContent = `Preparing ${resources.length} file${resources.length === 1 ? "" : "s"}...`;

  const { zipSync } = await loadZipLibrary();
  const usedNames = new Set();
  const entries = {};

  for (const resource of resources) {
    if (status) status.textContent = `Adding ${stripSiteEmoji(resource.title)}...`;
    const response = await fetch(resource.downloadUrl);
    if (!response.ok) throw new Error(`Could not download ${resource.title}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const fileName = uniqueZipName(usedNames, resource.fileName || `${resource.title}.pdf`);
    entries[fileName] = bytes;
  }

  const zipped = zipSync(entries, { level: 6 });
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeZipEntryName(course?.code || courseCode)}-${safeZipEntryName(course?.title || "resources")}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  if (status) status.textContent = "Course ZIP downloaded.";
}

async function expandBulkInputFiles(files, status, list) {
  const expanded = [];

  for (const file of files) {
    if (getFileExtension(file.name) !== ".zip") {
      if (BULK_ALLOWED_EXTENSIONS.has(getFileExtension(file.name))) expanded.push(file);
      continue;
    }

    status.textContent = `Reading ZIP: ${stripSiteEmoji(file.name)}...`;

    try {
      const { unzipSync } = await loadZipLibrary();
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));

      Object.entries(archive).forEach(([entryPath, bytes]) => {
        const fileName = entryPath.split(/[\\/]/).pop();
        if (!fileName || !BULK_ALLOWED_EXTENSIONS.has(getFileExtension(fileName))) return;

        const unzippedFile = new File([bytes], fileName.trim(), { type: getMimeType(fileName) });
        Object.defineProperty(unzippedFile, "bulkPath", {
          value: `${file.name}/${entryPath}`,
          configurable: true,
        });
        expanded.push(unzippedFile);
      });

      renderBulkUploadLine(list, `Read ZIP: ${stripSiteEmoji(file.name)}`, "success");
    } catch (error) {
      renderBulkUploadLine(list, `Could not read ZIP ${stripSiteEmoji(file.name)}: ${error.message}`, "error");
    }
  }

  return expanded;
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
          renderStaffSummary();
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
          renderStaffSummary();
        },
        (error) => showToast(error.message || "Could not load suggestions.", "error")
      );
    }

    if (canEnter && !state.engagementUnsubscribe && getElement("#staffSummaryGrid")) {
      const progressUnsubscribe = state.backend.watchResourceProgress(
        (rows) => {
          state.resourceProgress = rows;
          renderStaffSummary();
        },
        (error) => showToast(error.message || "Could not load reader progress.", "error")
      );
      const feedbackUnsubscribe = state.backend.watchResourceFeedback(
        (rows) => {
          state.resourceFeedback = rows;
          renderStaffSummary();
        },
        (error) => showToast(error.message || "Could not load helpful votes.", "error")
      );
      state.engagementUnsubscribe = () => {
        progressUnsubscribe?.();
        feedbackUnsubscribe?.();
      };
    }

    if (canEnter && !state.realtimeUnsubscribe) {
      state.realtimeUnsubscribe = connectRealtimeData();
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

    if (!canEnter && state.engagementUnsubscribe) {
      state.engagementUnsubscribe();
      state.engagementUnsubscribe = null;
      state.resourceProgress = [];
      state.resourceFeedback = [];
      renderStaffSummary();
    }

    if (!canEnter && state.realtimeUnsubscribe) {
      state.realtimeUnsubscribe();
      state.realtimeUnsubscribe = null;
      state.resources = [];
      state.announcements = [];
      renderAll();
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
    const fileInput = uploadForm.querySelector('input[name="file"]');

    fileInput?.addEventListener("change", () => {
      const formData = new FormData(uploadForm);
      const file = formData.get("file");
      const possibleDuplicate = findPossibleDuplicate({
        courseCode: String(formData.get("courseCode")),
        title: String(formData.get("title") || file?.name || ""),
        file,
      });
      if (possibleDuplicate && uploadStatus) {
        uploadStatus.textContent = `Possible duplicate: ${possibleDuplicate.title}. Check before uploading.`;
      }
    });

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
      const possibleDuplicate = findPossibleDuplicate({
        courseCode: String(formData.get("courseCode")),
        title: String(formData.get("title")),
        file,
      });

      if (possibleDuplicate && !confirm(`This looks similar to "${possibleDuplicate.title}". Upload anyway?`)) {
        uploadStatus.textContent = "Upload cancelled so you can check the existing file first.";
        return;
      }

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

/* GENERIC BULK UPLOAD: Admin can select a prepared folder and upload by course/type. */
function connectGenericBulkUpload() {
  const form = getElement("#genericBulkUploadForm");
  const fileInput = getElement("#genericBulkFiles");
  const looseInput = getElement("#genericBulkLooseFiles");
  const status = getElement("#genericBulkStatus");
  const list = getElement("#genericBulkList");
  if (!form || !fileInput || !looseInput) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedFiles = [...fileInput.files, ...looseInput.files];
    const uploadedByCourse = new Map();
    let uploadedCount = 0;
    let skippedCount = 0;

    if (!selectedFiles.length) {
      status.textContent = "Choose the prepared folder, ZIP files, or loose files first.";
      return;
    }

    list.innerHTML = "";
    status.textContent = `Preparing ${selectedFiles.length} selected item${selectedFiles.length === 1 ? "" : "s"}...`;
    const files = await expandBulkInputFiles(selectedFiles, status, list);

    if (!files.length) {
      status.textContent = "No uploadable files were found. Choose the prepared folder or the original ZIP files.";
      return;
    }

    status.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`;

    for (const file of files) {
      const metadata = buildBulkMetadata(file);

      if (!metadata.course) {
        skippedCount += 1;
        renderBulkUploadLine(list, `Skipped unknown course: ${stripSiteEmoji(file.name)}`, "muted");
        continue;
      }

      if (file.size > 50 * 1024 * 1024) {
        skippedCount += 1;
        renderBulkUploadLine(list, `Skipped over 50 MB: ${metadata.title}`, "muted");
        continue;
      }

      const possibleDuplicate = findPossibleDuplicate({
        courseCode: metadata.course.code,
        title: metadata.title,
        file,
      });

      if (possibleDuplicate) {
        skippedCount += 1;
        renderBulkUploadLine(list, `Possible duplicate skipped: ${metadata.title}`, "muted");
        continue;
      }

      status.textContent = `Uploading ${metadata.title}...`;

      try {
        await state.backend.uploadResource(
          {
            title: metadata.title,
            courseCode: metadata.course.code,
            courseTitle: metadata.course.title,
            type: metadata.type,
            note: metadata.note,
          },
          file,
          (progress) => {
            status.textContent = `Uploading ${metadata.title}... ${progress}%`;
          }
        );

        uploadedCount += 1;
        uploadedByCourse.set(metadata.course.code, (uploadedByCourse.get(metadata.course.code) || 0) + 1);
        renderBulkUploadLine(list, `Uploaded: ${metadata.title}`, "success");
      } catch (error) {
        skippedCount += 1;
        renderBulkUploadLine(list, `${metadata.title}: ${error.message || "Upload failed."}`, "error");
      }
    }

    for (const [courseCode, count] of uploadedByCourse.entries()) {
      const course = findCourse(courseCode);
      await state.backend
        .postAnnouncement({
          title: `${courseCode} materials uploaded`,
          priority: "Normal",
          message: `${count} ${count === 1 ? "resource has" : "resources have"} been added for ${
            course?.title || courseCode
          }. Open the course page to download the new slides, notes, textbooks, practical materials, or past questions.`,
        })
        .catch((error) => renderBulkUploadLine(list, `Announcement skipped for ${courseCode}: ${error.message}`, "error"));
    }

    form.reset();
    status.textContent = `Folder upload complete. ${uploadedCount} uploaded, ${skippedCount} skipped. Announcements posted for uploaded courses.`;
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
      const pushState = await connectPushNotifications(session, true, { forcePrompt: true });
      if (pushState?.subscribed) {
        showToast("Push notifications are enabled on this device.");
        renderNotificationSetup();
      } else if (status) {
        status.textContent = "If your browser allows web push, notifications are now linked to this device.";
      }
    } catch (error) {
      if (status) status.textContent = error.message || "Notification setup could not finish on this browser.";
    } finally {
      button.disabled = false;
    }
  });
}

/* RESOURCE ENGAGEMENT: Lets students tag progress, vote helpful, and download course ZIPs. */
function connectResourceEngagement() {
  document.addEventListener("click", async (event) => {
    const progressButton = event.target.closest("[data-progress-resource]");
    const helpfulButton = event.target.closest("[data-helpful-resource]");
    const zipButton = event.target.closest("[data-download-course-zip]");

    try {
      if (progressButton) {
        const resourceId = progressButton.dataset.progressResource;
        const status = progressButton.dataset.progressStatus;
        progressButton.disabled = true;
        const progress = await state.backend.saveResourceProgress({ resourceId, status });
        setResourceProgress(resourceId, progress);
        renderResourceCards();
        renderCourseGrid();
        renderExamMode();
        showToast(`${progressLabel(progress?.status || status)} tag saved.`);
        return;
      }

      if (helpfulButton) {
        const resourceId = helpfulButton.dataset.helpfulResource;
        const resource = state.resources.find((item) => item.id === resourceId);
        const current = getResourceFeedback(resource);
        helpfulButton.disabled = true;
        const feedback = await state.backend.saveResourceFeedback({
          resourceId,
          helpful: !current.helpful,
        });
        setResourceFeedback(resourceId, feedback);
        renderResourceCards();
        renderCourseGrid();
        renderExamMode();
        showToast(feedback.helpful ? "Marked as helpful." : "Helpful vote removed.");
        return;
      }

      if (zipButton) {
        zipButton.disabled = true;
        await downloadCourseZip(zipButton.dataset.downloadCourseZip);
        zipButton.disabled = false;
      }
    } catch (error) {
      if (progressButton) progressButton.disabled = false;
      if (helpfulButton) helpfulButton.disabled = false;
      if (zipButton) zipButton.disabled = false;
      showToast(error.message || "Action failed.", "error");
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
      pdfText(margin, 528, "Current GES/GST rows matched to Physiology Class 2k29 registration.", 10),
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

/* NOTIFICATION CENTER ACTIONS: Lets students clear the in-site unread badge. */
function connectNotificationCenter() {
  const button = getElement("#markNotificationsRead");
  if (!button) return;

  button.addEventListener("click", () => {
    const isCompact = getElement(".notification-center")?.dataset.compact === "true";
    if (isCompact) {
      saveNotificationCenterCollapsed(false);
      renderNotificationCenter();
      return;
    }

    saveReadNotificationIds(new Set(getNotificationItems().map((item) => item.id)));
    saveNotificationCenterCollapsed(true);
    renderNotificationCenter();
    showToast("Notification center marked as read.");
  });
}

function connectRealtimeData() {
  const unsubscribeResources = state.backend.watchResources(
    (resources) => {
      state.resources = resources;
      rememberLiveItems("resources", resources, (item) => `New ${item.type || "resource"} posted: ${item.title}`);
      renderAll();
    },
    (error) => showToast(error.message || "Could not load resources.", "error")
  );

  const unsubscribeAnnouncements = state.backend.watchAnnouncements(
    (announcements) => {
      state.announcements = announcements;
      rememberLiveItems("announcements", announcements, (item) => `New announcement: ${item.title}`);
      renderAll();
    },
    (error) => showToast(error.message || "Could not load announcements.", "error")
  );

  renderMembersTable();

  return () => {
    unsubscribeResources?.();
    unsubscribeAnnouncements?.();
  };
}

function startPublicRealtimeData() {
  if (document.body.dataset.portal === "staff" || state.realtimeUnsubscribe) return;
  state.realtimeUnsubscribe = connectRealtimeData();
}

async function init() {
  state.backend = await createBackend();
  setMemberGate(!getMemberSession()?.memberId);
  populateCourseSelects();
  renderAll();
  connectSearch();
  connectStaffPortal(document.body.dataset.portalRole === "admin" ? ["admin"] : ["rep", "admin"]);
  connectRepForms();
  connectGenericBulkUpload();
  connectSuggestionForm();
  connectStaffActions();
  connectCopyButtons();
  connectNotificationSetup();
  connectNotificationCenter();
  connectResourceEngagement();
  connectTimetableDownload();
  window.setInterval(() => {
    renderNextExam();
    renderGesCountdown();
    renderExamMode();
  }, 1000);
  const memberReady = await ensureMemberOnboarding();
  if (memberReady) startPublicRealtimeData();
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "The portal could not start.", "error");
});
