import { cbtTimetable, findCourse, firstSemesterCourses, resourceTypes } from "./data.js?v=20260605b";
import { createBackend } from "./supabase-service.js?v=20260605b";
import { isSupabaseConfigured } from "./supabase-config.js?v=20260605b";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const MEMBER_SESSION_COOKIE = "physiok29_member_session";
const ONESIGNAL_PROMPT_KEY = "physiology2k29.onesignalPromptAsked";
const NOTIFICATION_READ_KEY = "physiology2k29.readNotifications";
const NOTIFICATION_COLLAPSED_KEY = "physiology2k29.notificationCenterCollapsed";
const INSTALL_DISMISSED_KEY = "physiology2k29.installPromptDismissed";
const INSTALL_ACCEPTED_KEY = "physiology2k29.installPromptAccepted";
const INSTALL_DISMISS_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const BULK_ALLOWED_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);

const state = {
  backend: null,
  resources: [],
  announcements: [],
  members: [],
  suggestions: [],
  resourceProgress: [],
  resourceFeedback: [],
  studyEvents: [],
  staffUser: null,
  staffRole: null,
  realtimeUnsubscribe: null,
  membersUnsubscribe: null,
  suggestionsUnsubscribe: null,
  engagementUnsubscribe: null,
  study: {
    setup: null,
    questions: [],
    startedAt: 0,
    timerId: null,
    warnings: 0,
    mode: "practice",
  },
  push: {
    checked: false,
    subscribed: false,
    subscriptionId: "",
  },
  pushListenerAttached: false,
  installPromptEvent: null,
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

function getQuizMode() {
  return document.body.dataset.quizMode === "exam" ? "exam" : "practice";
}

function quizModeLabel(mode = getQuizMode()) {
  return mode === "exam" ? "Hardcore Exam Room" : "Quiz Mode";
}

function getCourseTitle(courseCode) {
  return findCourse(courseCode)?.title || courseCode;
}

function dayKey(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftedDayKey(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return dayKey(date);
}

function calculateStudyStreak(events = []) {
  const days = new Set(events.map((event) => dayKey(event.createdAtMs)).filter(Boolean));
  let cursor = days.has(shiftedDayKey(0)) ? 0 : days.has(shiftedDayKey(-1)) ? -1 : null;
  if (cursor === null) return 0;

  let streak = 0;
  while (days.has(shiftedDayKey(cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function getMemberStudyEvents(memberId) {
  return state.studyEvents.filter((event) => event.memberId === memberId);
}

function getMemberStreak(memberId) {
  return calculateStudyStreak(getMemberStudyEvents(memberId));
}

function getStudySummary() {
  return state.study.setup?.summary || { streak: 0, weakTopics: [] };
}

function getStreakFireLevel(streak) {
  if (streak >= 7) return "strong";
  if (streak >= 3) return "active";
  if (streak >= 1) return "low";
  return "dim";
}

function updateStreakFire(streak) {
  const level = getStreakFireLevel(streak);
  getElements(".fire-streak").forEach((icon) => {
    icon.dataset.level = level;
  });
}

function hasStudyUi() {
  return Boolean(
    getElement("#studyStreakCount") ||
      getElement("#dashboardStudyStreak") ||
      getElement("#quizCourseSelect") ||
      getElement("#studentTopicTracker")
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

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIosBrowser() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function hasStoredInstallDecision() {
  try {
    if (localStorage.getItem(INSTALL_ACCEPTED_KEY)) return true;
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < INSTALL_DISMISS_SNOOZE_MS;
  } catch {
    return false;
  }
}

function shouldShowInstallPrompt() {
  if (document.body.dataset.portal === "staff" || !isDashboardPage() || isStandaloneApp() || hasStoredInstallDecision()) return false;
  return Boolean(state.installPromptEvent || isIosBrowser());
}

/* HOME SCREEN PROMPT: Shows only when the browser says the portal is not installed yet. */
function renderInstallPrompt() {
  const existingPanel = getElement("#installPrompt");
  if (!shouldShowInstallPrompt()) {
    existingPanel?.remove();
    return;
  }

  const main = getElement(".main-area");
  if (!main || existingPanel) return;

  const isIos = isIosBrowser() && !state.installPromptEvent;
  const panel = document.createElement("section");
  panel.id = "installPrompt";
  panel.className = "install-prompt";
  panel.innerHTML = `
    <div>
      <span class="material-symbols-rounded" aria-hidden="true">add_to_home_screen</span>
      <div>
        <strong>Keep PhysioK29 one tap away.</strong>
        <p>${isIos ? "On iPhone, use Share, then Add to Home Screen." : "Install the portal on this device for faster access before classes and papers."}</p>
      </div>
    </div>
    <div class="install-actions">
      ${isIos ? "" : `<button class="primary-action" type="button" data-install-app>Install</button>`}
      <button class="icon-button" type="button" data-dismiss-install aria-label="Dismiss install prompt">
        <span class="material-symbols-rounded" aria-hidden="true">close</span>
      </button>
    </div>
  `;
  main.appendChild(panel);
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

function connectInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPromptEvent = event;
    renderInstallPrompt();
  });

  window.addEventListener("appinstalled", () => {
    try {
      localStorage.setItem(INSTALL_ACCEPTED_KEY, "true");
    } catch {
      // The app is installed even if storage is unavailable.
    }
    state.installPromptEvent = null;
    getElement("#installPrompt")?.remove();
  });

  document.addEventListener("click", async (event) => {
    const installButton = event.target.closest("[data-install-app]");
    const dismissButton = event.target.closest("[data-dismiss-install]");

    if (dismissButton) {
      try {
        localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      } catch {
        // Dismissal is best-effort.
      }
      getElement("#installPrompt")?.remove();
      return;
    }

    if (!installButton || !state.installPromptEvent) return;

    installButton.disabled = true;
    try {
      await state.installPromptEvent.prompt();
      const choice = await state.installPromptEvent.userChoice;
      if (choice?.outcome === "accepted") {
        localStorage.setItem(INSTALL_ACCEPTED_KEY, "true");
        getElement("#installPrompt")?.remove();
      }
      state.installPromptEvent = null;
    } catch (error) {
      showToast(error.message || "Install prompt could not open.", "error");
    } finally {
      installButton.disabled = false;
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
      <details class="signin-help">
        <summary>
          <span class="material-symbols-rounded" aria-hidden="true">help</span>
          Having trouble signing in?
        </summary>
        <ul>
          <li>Use your matric number without spaces.</li>
          <li>Type at least two names from the class list. Order is flexible.</li>
          <li>Hyphens, joined names, and common spelling differences are accepted.</li>
          <li>If it still fails, send your full name, matric number, and what you typed to a course rep.</li>
        </ul>
        <a class="signin-support-link" href="https://wa.link/757ou3" target="_blank" rel="noopener">
          <span class="material-symbols-rounded" aria-hidden="true">chat</span>
          Message support on WhatsApp
        </a>
      </details>
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
      loadQuizSetup();
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
    title.textContent = "GES is wrapped";
    meta.textContent = "Onto the next. Breathe, reset, then move with clean focus.";
    return;
  }

  const isCurrent = now >= next.start && now < next.end;
  title.textContent = next.course;
  meta.textContent = isCurrent
    ? `Live now until ${next.time.split("-")[1].trim()} - ${next.batch}`
    : `Onto the next: ${formatExamDate(next.start)} - ${next.time} - ${next.batch}`;
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
    title.textContent = "GES is done. Onto the next.";
    meta.textContent = "Take a minute to unwind, recharge, and come back lighter. The next paper gets a fresher version of you.";
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
    ? `You are in it now. Ends ${next.time.split("-")[1].trim()}. Stay calm and finish clean.`
    : `GES is wrapped. Onto the next: ${formatFullExamDate(next.start)}. Reset, then lock in.`;
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
  if (!title || !meta || !grid || !resources) return;

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

  if (body) {
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
  }

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

  const visibleLimit = isDashboardPage() ? 4 : 12;
  list.innerHTML = items
    .slice(0, visibleLimit)
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

function renderTopicTracker(summary = getStudySummary()) {
  const target = getElement("#studentTopicTracker");
  if (!target) return;

  const weakTopics = summary.weakTopics || [];
  if (!weakTopics.length && isDashboardPage()) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }

  target.hidden = false;
  target.innerHTML = weakTopics.length
    ? weakTopics
        .map(
          (topic) => `
            <article class="topic-chip">
              <strong>${escapeHtml(topic.courseCode || "Course")}</strong>
              <span>${escapeHtml(topic.topic || "General")}</span>
              <small>${Number(topic.accuracy || 0)}% accuracy</small>
            </article>
          `
        )
        .join("")
    : `<article class="topic-chip" data-tone="clear">
        <strong>Clear board</strong>
        <span>Weak topics will appear after quizzes.</span>
        <small>Start with any course</small>
      </article>`;
}

/* STUDY DASHBOARD: Shows streak, motivation, and topic tracker on student pages. */
function renderStudyDashboard() {
  const summary = getStudySummary();
  const streak = Number(summary.streak || 0);
  const weakCount = (summary.weakTopics || []).length;
  const motivation =
    streak > 1
      ? `You are on a ${streak}-day streak. Keep it light, steady, and honest.`
      : weakCount
        ? "Your topic tracker has a few repair points. A short focused quiz will do more than a long anxious scroll."
        : "Start with one short quiz. The portal will begin tracking your streak and weak topics from there.";

  const streakTargets = ["#studyStreakCount", "#dashboardStudyStreak"];
  streakTargets.forEach((selector) => {
    const target = getElement(selector);
    if (target) target.textContent = streak;
  });
  updateStreakFire(streak);

  const weakTarget = getElement("#studyWeakCount");
  if (weakTarget) weakTarget.textContent = weakCount;

  const motivationTarget = getElement("#studyMotivation");
  if (motivationTarget) motivationTarget.textContent = motivation;

  renderTopicTracker(summary);
}

function populateQuizTopicSelect() {
  const courseSelect = getElement("#quizCourseSelect");
  const topicSelect = getElement("#quizTopicSelect");
  if (!courseSelect || !topicSelect) return;

  const selectedCourse = courseSelect.value;
  const topics = state.study.setup?.courses?.[selectedCourse]?.topics || {};
  const topicEntries = Object.entries(topics).sort((a, b) => a[0].localeCompare(b[0]));
  topicSelect.innerHTML = `<option value="">All topics</option>${topicEntries
    .map(([topic]) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`)
    .join("")}`;
}

function populateQuizControls() {
  const courseSelect = getElement("#quizCourseSelect");
  if (!courseSelect) return;

  const courses = state.study.setup?.courses || {};
  const available = firstSemesterCourses.filter((course) => courses[course.code]?.count);
  courseSelect.innerHTML = available.length
    ? available
        .map(
          (course) =>
            `<option value="${course.code}">${course.code} - ${escapeHtml(course.title)}</option>`
        )
        .join("")
    : `<option value="">Practice questions are not ready yet</option>`;
  courseSelect.disabled = !available.length;
  populateQuizTopicSelect();
}

async function loadQuizSetup() {
  if (!hasStudyUi() || !getMemberSession()?.memberId) return;

  try {
    state.study.setup = await state.backend.getQuizSetup();
    populateQuizControls();
    renderStudyDashboard();
  } catch (error) {
    const status = getElement("#quizStatus");
    if (status) status.textContent = error.message || "Could not load the study engine yet.";
  }
}

function stopQuizTimer() {
  if (state.study.timerId) window.clearInterval(state.study.timerId);
  state.study.timerId = null;
}

function renderQuizTimer() {
  const target = getElement("#quizTimer");
  if (!target) return;

  const elapsed = Math.floor((Date.now() - state.study.startedAt) / 1000);
  if (state.study.mode !== "exam") {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    target.textContent = `${minutes}:${String(seconds).padStart(2, "0")} elapsed`;
    return;
  }

  const duration = Number(state.study.durationSeconds || 1800);
  const remaining = Math.max(0, duration - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  target.textContent = `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
  if (remaining <= 0) {
    stopQuizTimer();
    getElement("#submitQuizAttempt")?.click();
  }
}

function startQuizTimer(durationSeconds = 0) {
  stopQuizTimer();
  state.study.startedAt = Date.now();
  state.study.durationSeconds = Number(durationSeconds || 0);
  renderQuizTimer();
  state.study.timerId = window.setInterval(renderQuizTimer, 1000);
}

function renderQuizQuestions() {
  const form = getElement("#quizAnswerForm");
  const panel = getElement("#quizPlayerPanel");
  const resultPanel = getElement("#quizResultPanel");
  const title = getElement("#quizPlayerTitle");
  const meta = getElement("#quizPlayerMeta");
  if (!form || !panel) return;

  if (title) title.textContent = state.study.mode === "exam" ? "Simulated exam attempt" : "Practice questions";
  if (meta) meta.textContent = `${quizModeLabel(state.study.mode)} - ${escapeHtml(state.study.courseCode || "")}`;
  panel.hidden = false;
  if (resultPanel) resultPanel.hidden = true;

  form.innerHTML = state.study.questions
    .map(
      (question, index) => `
        <fieldset class="quiz-question-card">
          <legend>
            <span>Question ${index + 1}</span>
            <small>${escapeHtml(question.topic || "General")} - ${escapeHtml(question.difficulty || "Medium")}</small>
          </legend>
          <p>${escapeHtml(question.question)}</p>
          <div class="quiz-options">
            ${(question.options || [])
              .map(
                (option) => `
                  <label>
                    <input type="radio" name="question-${question.id}" value="${escapeHtml(option)}" />
                    <span>${escapeHtml(option)}</span>
                  </label>
                `
              )
              .join("")}
          </div>
        </fieldset>
      `
    )
    .join("");
}

function renderQuizResults(data) {
  const panel = getElement("#quizResultPanel");
  if (!panel) return;

  const percent = data.total ? Math.round((Number(data.score || 0) / Number(data.total)) * 100) : 0;
  panel.hidden = false;
  panel.innerHTML = `
    <div class="section-header">
      <div>
        <p class="eyebrow">Attempt complete</p>
        <h2>${percent}% score</h2>
      </div>
      <span class="soft-pill">${Number(data.score || 0)} of ${Number(data.total || 0)}</span>
    </div>
    <p class="result-motivation">${escapeHtml(data.motivation || "Attempt saved. Review your misses and try again.")}</p>
    <div class="quiz-review-list">
      ${(data.results || [])
        .map(
          (result) => `
            <article class="quiz-review-card" data-correct="${result.correct ? "true" : "false"}">
              <strong>${escapeHtml(result.question)}</strong>
              <p>Your answer: ${escapeHtml(result.selectedAnswer || "No answer")}</p>
              <p>Correct answer: ${escapeHtml(result.correctAnswer || "")}</p>
              <small>${escapeHtml(result.explanation || result.sourceHint || "")}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
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
              <td>${getMemberStreak(member.id)} day${getMemberStreak(member.id) === 1 ? "" : "s"}</td>
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
    : `<tr><td colspan="${canDeleteMembers ? 6 : 5}">No class members yet.</td></tr>`;
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
  const activeStudyMembers = new Set(
    state.studyEvents.filter((event) => Date.now() - event.createdAtMs < 7 * 24 * 60 * 60 * 1000).map((event) => event.memberId)
  ).size;
  const topStreak = state.members.reduce((best, member) => Math.max(best, getMemberStreak(member.id)), 0);
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
    <article class="metric-card staff-summary-card">
      <span>${activeStudyMembers}</span>
      <small>students active this week</small>
    </article>
    <article class="metric-card staff-summary-card">
      <span>${topStreak}</span>
      <small>top study streak</small>
    </article>
  `;
}

function renderAll() {
  renderSiteCredit();
  renderScholarGreeting();
  renderInstallPrompt();
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
  renderStudyDashboard();
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

function describeStaffLoginError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (!message) return "The portal could not complete sign-in. Check the email, password, and network.";
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "Supabase rejected the email or password. Re-enter both carefully, then try again.";
  }
  if (message.includes("email not confirmed")) {
    return "This staff account exists but the email has not been confirmed in Supabase Auth.";
  }
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("timeout")) {
    return "The browser could not reach Supabase. Check the connection and try again.";
  }
  return error.message || "Could not sign in.";
}

function setStaffDiagnostic(element, message, tone = "muted") {
  if (!element) return;
  element.dataset.tone = tone;
  element.textContent = message;
}

/* REP/ADMIN AUTH: Protects staff portals through Supabase Auth + staff_roles table. */
function connectStaffPortal(allowedRoles) {
  const loginForm = getElement("#staffLoginForm");
  const portal = getElement("#staffPortal");
  const loginPanel = getElement("#staffLoginPanel");
  const status = getElement("#staffStatus");
  const diagnostic = getElement("#staffDiagnostic");
  const signOut = getElement("#staffSignOut");
  if (!loginForm || !portal || !loginPanel) return;

  setStaffDiagnostic(
    diagnostic,
    "Step 1 checks the email/password. Step 2 checks whether the account has the right staff role.",
  );

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    try {
      status.textContent = "Signing in...";
      setStaffDiagnostic(diagnostic, "Checking Supabase Auth credentials...");
      await state.backend.signInRep(String(formData.get("email")), String(formData.get("password")));
      status.textContent = "Credentials accepted. Checking portal access...";
      setStaffDiagnostic(diagnostic, "Credentials accepted. Checking staff_roles now.", "success");
    } catch (error) {
      status.textContent = "Could not sign in.";
      setStaffDiagnostic(diagnostic, describeStaffLoginError(error), "error");
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
    if (signOut) signOut.hidden = !user;

    if (canEnter) {
      status.textContent = "";
      setStaffDiagnostic(diagnostic, "Portal access confirmed.", "success");
    } else if (user && !role) {
      status.textContent = "Signed in, but no staff role was found.";
      setStaffDiagnostic(
        diagnostic,
        "The account exists in Auth, but staff_roles has no matching admin/rep row for it.",
        "error",
      );
    } else if (user && role && !allowedRoles.includes(role.role)) {
      const target = role.role === "admin" ? "the admin portal" : "the rep portal";
      status.textContent = `Signed in as ${role.role}, but this page does not allow that role.`;
      setStaffDiagnostic(diagnostic, `Open ${target}, or update this user's role in staff_roles.`, "error");
    } else if (!user) {
      status.textContent = "";
      setStaffDiagnostic(
        diagnostic,
        "Step 1 checks the email/password. Step 2 checks whether the account has the right staff role.",
      );
    }

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
          renderMembersTable();
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
      const studyUnsubscribe = state.backend.watchStudyEvents(
        (rows) => {
          state.studyEvents = rows;
          renderStaffSummary();
          renderMembersTable();
        },
        (error) => showToast(error.message || "Could not load study streaks.", "error")
      );
      state.engagementUnsubscribe = () => {
        progressUnsubscribe?.();
        feedbackUnsubscribe?.();
        studyUnsubscribe?.();
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
      state.studyEvents = [];
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
        const result = await state.backend.uploadResource(
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
        uploadStatus.textContent = result?.notification?.ok
          ? "Upload saved. Push alert sent."
          : `Upload saved. Push alert failed: ${result?.notification?.error || "check notification setup."}`;
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
        const result = await state.backend.postAnnouncement({
          title: String(formData.get("title")).trim(),
          message: String(formData.get("message")).trim(),
          priority: String(formData.get("priority")),
        });
        announcementForm.reset();
        announcementStatus.textContent = result?.notification?.ok
          ? "Announcement posted. Push alert sent."
          : `Announcement posted. Push alert failed: ${result?.notification?.error || "check notification setup."}`;
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

/* QUIZ MODE: Starts practice/exam sessions and submits answers securely through the portal function. */
function connectQuizMode() {
  const setupForm = getElement("#quizSetupForm");
  const courseSelect = getElement("#quizCourseSelect");
  const submitButton = getElement("#submitQuizAttempt");
  if (!setupForm && !submitButton) return;

  courseSelect?.addEventListener("change", populateQuizTopicSelect);

  setupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = getElement("#quizStatus");
    const formData = new FormData(setupForm);
    const mode = getQuizMode();
    const courseCode = String(formData.get("courseCode") || "");
    const topic = String(formData.get("topic") || "");
    const requestedLimit = Number(formData.get("limit") || (mode === "exam" ? 30 : 10));
    const limit = Math.max(5, Math.min(120, requestedLimit));

    if (!courseCode) {
      if (status) status.textContent = "No questions are available for this selection yet.";
      return;
    }

    try {
      if (status) status.textContent = "Preparing questions...";
      state.study.mode = mode;
      state.study.courseCode = courseCode;
      state.study.topic = topic;
      const data = await state.backend.getQuizQuestions({ mode, courseCode, topic, limit });
      state.study.questions = data.questions || [];
      if (!state.study.questions.length) {
        if (status) status.textContent = "No questions found for that selection yet.";
        return;
      }
      if (status) status.textContent = "";
      renderQuizQuestions();
      startQuizTimer(mode === "exam" ? Math.max(300, state.study.questions.length * 60) : 0);
      getElement("#quizPlayerPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (status) status.textContent = error.message || "Could not start this quiz.";
    }
  });

  submitButton?.addEventListener("click", async () => {
    if (!state.study.questions.length) return;
    submitButton.disabled = true;
    const status = getElement("#quizStatus");
    const answers = state.study.questions.map((question) => ({
      questionId: question.id,
      selectedAnswer:
        getElements(`input[name="question-${question.id}"]`).find((option) => option.checked)?.value || "",
    }));
    const durationSeconds = Math.floor((Date.now() - state.study.startedAt) / 1000);

    try {
      if (status) status.textContent = "Submitting attempt...";
      stopQuizTimer();
      const data = await state.backend.submitQuizAttempt({
        mode: state.study.mode,
        courseCode: state.study.courseCode,
        topic: state.study.topic,
        durationSeconds,
        answers,
      });
      state.study.setup = { ...(state.study.setup || {}), summary: data.summary || getStudySummary() };
      renderQuizResults(data);
      renderStudyDashboard();
      if (status) status.textContent = "";
      getElement("#quizResultPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (status) status.textContent = error.message || "Could not submit this attempt.";
      startQuizTimer(state.study.mode === "exam" ? Math.max(300, state.study.questions.length * 60) : 0);
    } finally {
      submitButton.disabled = false;
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
      pdfText(margin, 528, "Final faculty exam rows matched to Physiology Class 2k29 courses.", 10),
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

/* MEMBERS PDF: Gives staff a clean offline class list without exposing internal ids. */
function createMembersPdfBlob() {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 34;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 22;
  const rowsPerPage = 18;
  const members = [...state.members].sort((a, b) => a.name.localeCompare(b.name));
  const columns = [
    { label: "No.", width: 38, value: (_, index) => String(index + 1), max: 5 },
    { label: "Name", width: 230, value: (member) => member.name, max: 35 },
    { label: "Matric", width: 92, value: (member) => member.matricNumber, max: 14 },
    { label: "Push", width: 84, value: (member) => (member.notificationEnabled ? "On" : "Off"), max: 8 },
    { label: "Streak", width: 80, value: (member) => `${getMemberStreak(member.id)} day(s)`, max: 12 },
    { label: "Last seen", width: tableWidth - 524, value: (member) => formatDate(member.lastSeenAtMs || member.createdAtMs), max: 32 },
  ];
  const pages = [];

  for (let start = 0; start < members.length || (start === 0 && members.length === 0); start += rowsPerPage) {
    const pageRows = members.slice(start, start + rowsPerPage);
    const pageNumber = pages.length + 1;
    const totalPages = Math.ceil(Math.max(members.length, 1) / rowsPerPage) || 1;
    const tableTop = 468;
    const headerBottom = tableTop - 26;
    const operations = [
      "1 1 1 rg 0 0 842 595 re f",
      "0.09 0.11 0.12 rg",
      pdfText(margin, 548, "PhysioK29 Class Members", 20, "F2"),
      "0.39 0.44 0.42 rg",
      pdfText(margin, 528, `${members.length} registered member${members.length === 1 ? "" : "s"}. Generated from the staff portal.`, 10),
      pdfText(margin, 512, `Page ${pageNumber} of ${totalPages}`, 9),
      "0.88 0.96 0.93 rg",
      `${margin} ${headerBottom} ${tableWidth} 26 re f`,
      "0.82 0.80 0.74 RG",
      `${margin} ${headerBottom} ${tableWidth} 26 re S`,
    ];

    let cursorX = margin;
    columns.forEach((column) => {
      operations.push("0.09 0.11 0.12 rg", pdfText(cursorX + 7, tableTop - 17, column.label, 9, "F2"));
      cursorX += column.width;
    });

    pageRows.forEach((member, rowIndex) => {
      const rowTop = headerBottom - rowIndex * rowHeight;
      const rowBottom = rowTop - rowHeight;
      operations.push("0.82 0.80 0.74 RG", pdfLine(margin, rowBottom, margin + tableWidth, rowBottom));
      cursorX = margin;
      columns.forEach((column) => {
        const cell = fitPdfText(column.value(member, start + rowIndex), column.max);
        operations.push("0.09 0.11 0.12 rg", pdfText(cursorX + 7, rowBottom + 8, cell, 8.5));
        cursorX += column.width;
      });
    });

    if (!pageRows.length) {
      operations.push("0.39 0.44 0.42 rg", pdfText(margin + 7, headerBottom - 18, "No class members available yet.", 10));
    }

    operations.push(
      "0.39 0.44 0.42 rg",
      pdfText(margin, 44, "Private class list. Keep within Physiology 2k29 staff use.", 9),
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
    link.download = "physiok29-final-exam-timetable.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

/* MEMBERS DOWNLOAD: Lets reps and admin download the private members list as a PDF. */
function connectMembersPdfDownload() {
  const button = getElement("#downloadMembersPdf");
  if (!button) return;

  button.addEventListener("click", () => {
    if (!state.members.length) {
      showToast("No class members available to download yet.", "error");
      return;
    }
    const blob = createMembersPdfBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `physiok29-class-members-${new Date().toISOString().slice(0, 10)}.pdf`;
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
  connectInstallPrompt();
  connectNotificationSetup();
  connectNotificationCenter();
  connectResourceEngagement();
  connectQuizMode();
  connectTimetableDownload();
  connectMembersPdfDownload();
  window.setInterval(() => {
    renderNextExam();
    renderGesCountdown();
    renderExamMode();
  }, 1000);
  const memberReady = await ensureMemberOnboarding();
  if (memberReady) {
    await loadQuizSetup();
    startPublicRealtimeData();
  }
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || "The portal could not start.", "error");
});
