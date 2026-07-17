import { BREAK_LOCK_UNTIL, cbtTimetable, findCourse, firstSemesterCourses, resourceTypes, secondSemesterResumption } from "./data.v20260717-1.js";
import { createBackend } from "./supabase-service.v20260717-1.js";
import { isSupabaseConfigured, supabaseConfig } from "./supabase-config.v20260717-1.js";

const APP_VERSION = "20260717-1";

// Mock data: Precise schedule extracted from CBT Timetable image
const MOCK_SCHEDULE = [
  // MONDAY
  { id: 's1', course_code: 'PHY 102', course_title: 'Physics II', day: 'Monday', start_time: '08:00:00', end_time: '09:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's2', course_code: 'CHM 102', course_title: 'Chemistry II', day: 'Monday', start_time: '09:00:00', end_time: '10:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: true },
  { id: 's3', course_code: 'BIO 102', course_title: 'Biology II', day: 'Monday', start_time: '14:00:00', end_time: '15:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: false, quiz_available: false },
  { id: 's4', course_code: 'PHY 108', course_title: 'Physics Lab (Group B2)', day: 'Monday', start_time: '10:00:00', end_time: '13:00:00', venue: 'Physics Lab', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: false, quiz_available: false },
  { id: 's5', course_code: 'BIO 108', course_title: 'Biology Lab (Group A1)', day: 'Monday', start_time: '14:00:00', end_time: '17:00:00', venue: 'Biology Lab', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: false, quiz_available: false },

  // TUESDAY
  { id: 's6', course_code: 'ZOO 101', course_title: 'Zoology I', day: 'Tuesday', start_time: '08:00:00', end_time: '09:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's7', course_code: 'CHM 102', course_title: 'Chemistry II', day: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: true },
  { id: 's8', course_code: 'CHM 108', course_title: 'Chemistry Lab (Group A4)', day: 'Tuesday', start_time: '14:00:00', end_time: '17:00:00', venue: 'Chemistry Lab', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: false, quiz_available: false },

  // WEDNESDAY
  { id: 's9', course_code: 'PHY 104', course_title: 'Physics IV', day: 'Wednesday', start_time: '08:00:00', end_time: '10:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's10', course_code: 'CHM 102', course_title: 'Chemistry II', day: 'Wednesday', start_time: '12:00:00', end_time: '13:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: true },
  { id: 's11', course_code: 'BIO 102', course_title: 'Biology II', day: 'Wednesday', start_time: '14:00:00', end_time: '15:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: false, quiz_available: false },

  // THURSDAY
  { id: 's12', course_code: 'PHY 102', course_title: 'Physics II', day: 'Thursday', start_time: '08:00:00', end_time: '09:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's13', course_code: 'ZOO 102', course_title: 'Zoology II', day: 'Thursday', start_time: '13:00:00', end_time: '14:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's14', course_code: 'ZOO 101', course_title: 'Zoology I', day: 'Thursday', start_time: '14:00:00', end_time: '15:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's15', course_code: 'CHM 102', course_title: 'Chemistry II', day: 'Thursday', start_time: '17:00:00', end_time: '18:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: true },

  // FRIDAY
  { id: 's16', course_code: 'ZOO 102', course_title: 'Zoology II', day: 'Friday', start_time: '08:00:00', end_time: '09:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: false },
  { id: 's17', course_code: 'CHM 102', course_title: 'Chemistry II', day: 'Friday', start_time: '09:00:00', end_time: '10:00:00', venue: 'Lecture Theatre', lecturer: 'TBD', week: 1, semester: 'Second', academic_session: '2025/2026', slides_available: true, quiz_available: true }
];

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
  quizAttempts: [],
  topicPerformance: [],
   studyGuide: [],
   studyGuideFlashcardCache: {},
   activeCourseTab: "",
   selectedStudyGuideCourse: "",
   selectedStudyGuideTopic: "",
  studyGuideFlashcardIndex: 0,
  realtimeUnsubscribe: null,
  study: {
    setup: null,
    questions: [],
    answers: {},
    currentIndex: 0,
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

function polishQuestionText(value = "") {
  return stripSiteEmoji(value)
    .replace(/\b(?:according to|based on|from|in)\s+(?:the\s+)?(?:provided\s+)?(?:text|document|notes?|material|slide|pdf)\b[:,]?\s*/gi, "")
    .replace(/\b(?:as\s+)?(?:stated|seen|shown)\s+(?:in|on)\s+(?:the\s+)?(?:text|document|notes?|slide|pdf)\b[:,]?\s*/gi, "")
    .replace(/\b(?:page|pg\.?)\s*\d+\b[:,]?\s*/gi, "")
    .replace(/\bwas\s+this\s+in\s+(?:the\s+)?(?:document|text|notes?|slide|pdf)\??/gi, "Which option best answers the question?")
    .replace(/\bwhich\s+of\s+these\s+was\s+mentioned\s+in\s+(?:the\s+)?(?:document|text|notes?|slide|pdf)\??/gi, "Which option is correct?")
    .replace(/\s+([?.!,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function polishedExplanationText(result = {}) {
  const raw = result.explanation || result.sourceHint || "";
  const cleaned = polishQuestionText(raw);
  if (cleaned) return cleaned;
  if (result.correctAnswer) {
    return `${result.correctAnswer} is the correct answer. Review the topic again and compare why the other options do not match the concept.`;
  }
  return "Review the topic again and focus on the key idea behind the correct option.";
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

function getMemberQuizAttempts(memberId, attempts = state.quizAttempts) {
  return attempts.filter((attempt) => attempt.memberId === memberId);
}

function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
}

function formatScorePercent(score = 0, total = 0) {
  return Number(total || 0) ? `${Math.round((Number(score || 0) / Number(total || 0)) * 100)}%` : "No score";
}

function summarizeMemberStudy(memberId, attempts = state.quizAttempts) {
  const memberAttempts = getMemberQuizAttempts(memberId, attempts);
  const questionCount = memberAttempts.reduce((sum, attempt) => sum + Number(attempt.questionCount || 0), 0);
  const score = memberAttempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
  const durationSeconds = memberAttempts.reduce((sum, attempt) => sum + Number(attempt.durationSeconds || 0), 0);
  const quizCount = memberAttempts.filter((attempt) => attempt.mode === "practice").length;
  const examCount = memberAttempts.filter((attempt) => attempt.mode === "exam").length;
  const lastAttemptAtMs = memberAttempts.reduce((latest, attempt) => Math.max(latest, Number(attempt.submittedAtMs || 0)), 0);

  return {
    attempts: memberAttempts,
    attemptCount: memberAttempts.length,
    quizCount,
    examCount,
    questionCount,
    score,
    durationSeconds,
    percent: questionCount ? Math.round((score / questionCount) * 100) : 0,
    streak: getMemberStreak(memberId),
    lastAttemptAtMs,
  };
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

function getResumptionDate() {
  return new Date(secondSemesterResumption.date);
}

/* BREAK LOCK: Returns true while the portal is in semester-break lockdown mode (now expired). */
function isBreakLockActive() {
  return Date.now() < BREAK_LOCK_UNTIL.getTime();
}

/* BREAK LOCK NAV: Dims and disables nav links to locked pages during break. */
function renderBreakLockNav() {
  if (!isBreakLockActive()) return;
  const OPEN_HREFS = ["./dashboard.html"];
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isOpen = OPEN_HREFS.some((h) => href.endsWith(h.replace("./", "")));
    if (!isOpen) {
      link.setAttribute("aria-disabled", "true");
      link.dataset.breakLocked = "true";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        showToast("Full access opens July 11. Enter your early-access code on the dashboard to unlock now.");
      });
    }
  });
  /* Hide the break-mode quick-action CTAs that link to locked pages */
  document.querySelectorAll("[data-break-hide]").forEach((el) => {
    el.hidden = true;
  });
}

/* BREAK LOCK REDIRECT: Sends students back to dashboard if they navigate directly to a locked page. */
function enforceBreakLock() {
  if (!isBreakLockActive()) return;
  const page = document.body.dataset.page || "";
  const OPEN_PAGES = ["dashboard"];
  if (!OPEN_PAGES.includes(page)) {
    window.location.replace("./dashboard.html");
  }
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

/* BOOT LOADER: Gives the portal a polished wait state while session checks finish. */
function renderBootLoader(message = "Opening portal") {
  if (getElement("#portalBootLoader")) {
    updateBootLoader(message);
    return;
  }

  const loader = document.createElement("section");
  loader.id = "portalBootLoader";
  loader.className = "portal-boot-loader";
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-label", "PhysioK29 is loading");
  loader.innerHTML = `
    <article class="boot-loader-card">
      <div class="boot-loader-logo">
        <img src="./assets/ui-logo.jpeg" alt="University of Ibadan logo" />
        <span class="boot-loader-ring" aria-hidden="true"></span>
      </div>
      <p class="eyebrow">PhysioK29</p>
      <h2>Opening your study space</h2>
      <p id="bootLoaderStatus">${escapeHtml(message)}</p>
      <div class="boot-loader-progress" aria-hidden="true"><span></span></div>
      <div class="boot-loader-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </article>
  `;
  document.body.appendChild(loader);
  document.body.dataset.booting = "true";
}

function updateBootLoader(message) {
  const status = getElement("#bootLoaderStatus");
  if (status) status.textContent = message;
}

function hideBootLoader() {
  const loader = getElement("#portalBootLoader");
  document.body.dataset.booting = "false";
  if (!loader) return;
  loader.classList.add("is-hiding");
  window.setTimeout(() => loader.remove(), 260);
}

function showBootLoaderError(message) {
  const loader = getElement("#portalBootLoader");
  if (!loader) {
    renderBootLoader("The portal could not start.");
    return showBootLoaderError(message);
  }

  loader.dataset.tone = "error";
  loader.classList.remove("is-hiding");
  loader.querySelector(".boot-loader-ring")?.setAttribute("aria-hidden", "true");
  updateBootLoader(message || "The portal could not start. Check your connection and reload.");
  const card = loader.querySelector(".boot-loader-card");
  if (card && !card.querySelector("[data-reload-portal]")) {
    card.insertAdjacentHTML(
      "beforeend",
      `<button class="secondary-action" type="button" data-reload-portal>
        <span class="material-symbols-rounded" aria-hidden="true">refresh</span>
        Reload portal
      </button>`
    );
    card.querySelector("[data-reload-portal]")?.addEventListener("click", () => window.location.reload());
  }
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

/* APP WORKER: Registers the root OneSignal worker that also owns the offline shell cache. */
function registerPortalServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  /* Force a fresh SW install by appending a unique version parameter.
     When this string changes, the browser treats it as a new script URL,
     bypassing both browser cache and CDN (Cloudflare/Pxxl) edge cache. */
  const SW_VERSION = "20260717-1";
  const swUrl = `/OneSignalSDKWorker.js?v=${SW_VERSION}`;

  navigator.serviceWorker
    .register(swUrl, { scope: "/", updateViaCache: "none" })
    .then((registration) => {
      /* Check for an update every time the page loads */
      registration.update();
    })
    .catch((error) => {
      console.warn("Portal service worker registration skipped:", error);
    });
}

/* OFFLINE STATUS: Keeps students aware when they are seeing cached shell pages. */
function renderConnectionStatus(tone = navigator.onLine ? "online" : "offline") {
  const existingPanel = getElement("#connectionStatus");
  if (document.body.dataset.portal === "staff") {
    existingPanel?.remove();
    return;
  }

  const isOffline = tone === "offline" || navigator.onLine === false;
  const isBackOnline = tone === "restored" && navigator.onLine !== false;
  if (!isOffline && !isBackOnline) {
    existingPanel?.remove();
    return;
  }

  const main = getElement(".main-area");
  if (!main) return;

  let panel = existingPanel;
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "connectionStatus";
    panel.className = "connection-status";
    const anchor = getElement(".page-header") || main.firstElementChild;
    if (anchor) {
      anchor.insertAdjacentElement("afterend", panel);
    } else {
      main.prepend(panel);
    }
  }

  panel.dataset.tone = isOffline ? "offline" : "online";
  panel.innerHTML = `
    <span class="material-symbols-rounded" aria-hidden="true">${isOffline ? "cloud_off" : "cloud_done"}</span>
    <div>
      <strong>${isOffline ? "Offline mode" : "Back online"}</strong>
      <p>${isOffline ? "Showing saved portal pages. Live uploads, announcements, and private lists will refresh when your connection returns." : "Connection restored. Live class updates are reconnecting."}</p>
    </div>
  `;

  if (isBackOnline) {
    window.setTimeout(() => panel.remove(), 3600);
  }
}

function connectConnectionStatus() {
  renderConnectionStatus();
  window.addEventListener("offline", () => renderConnectionStatus("offline"));
  window.addEventListener("online", () => {
    renderConnectionStatus("restored");
    startPublicRealtimeData();
  });
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
        <p>${isIos ? "On iPhone, use Share, then Add to Home Screen." : "Install the portal on this device for faster access before second semester starts."}</p>
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
  credit.textContent = "Built to help K29 students stay organized, study better, and prepare with confidence. Copyright 2026 Maverick.";
  main.appendChild(credit);
}

/* STUDENT GUIDE: Lightweight in-page tour for classmates who are new to the portal. */
function openSiteGuide() {
  if (getElement("#siteGuideModal")) return;

  const overlay = document.createElement("section");
  overlay.id = "siteGuideModal";
  overlay.className = "edit-modal site-guide-modal";
  overlay.innerHTML = `
    <article class="edit-card site-guide-card">
      <header>
        <div>
          <p class="eyebrow">Quick guide</p>
          <h2>How to use PhysioK29</h2>
          <p class="form-help">PhysioK29 keeps class resources, announcements, quizzes, resumption updates, and feedback in one secure place for verified K29 students.</p>
        </div>
        <button type="button" class="icon-button" data-close-edit aria-label="Close guide">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </header>
      <ol class="guide-list">
        <li><strong>Start on Dashboard.</strong> Check what is happening today: new resources, announcements, countdowns, weak topics, and your study streak.</li>
        <li><strong>Use Courses for materials.</strong> Pick a course to find lecture notes, PDFs, documents, revision files, and other uploaded resources.</li>
        <li><strong>Study inside the Reader.</strong> Open files on the site, move between pages, zoom, mark materials as done, or flag urgent resources.</li>
        <li><strong>Use Quiz Mode for revision.</strong> Choose a course or topic, answer shuffled questions, then review your score, corrections, and explanations.</li>
        <li><strong>Use Exam Room later.</strong> It gives you timed CBT-style attempts when the serious revision season returns.</li>
        <li><strong>Use Resumption and Smart Guide.</strong> Watch the return countdown, rest properly, then ease back into study with the guide and course materials.</li>
        <li><strong>Use Suggestions and Reps.</strong> Send feedback through the portal or contact Ayanfe and Raphael clearly when you need help.</li>
        <li><strong>Turn on notifications.</strong> New uploads and announcements can reach you faster. If browser push fails, the in-site notification center still keeps updates.</li>
      </ol>
      <div class="guide-actions">
        <a class="primary-action" href="./courses.html"><span class="material-symbols-rounded" aria-hidden="true">folder_open</span>Open courses</a>
        <a class="secondary-action" href="./quiz.html"><span class="material-symbols-rounded" aria-hidden="true">quiz</span>Start quiz</a>
        <a class="ghost-action external-link" href="https://wa.link/757ou3" target="_blank" rel="noopener">
          <span class="material-symbols-rounded" aria-hidden="true">chat</span>
          Get help
        </a>
      </div>
    </article>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("[data-close-edit]")?.addEventListener("click", closeEditModal);
}

function connectSiteGuide() {
  document.addEventListener("click", (event) => {
    const guideButton = event.target.closest("[data-open-site-guide]");
    if (!guideButton) return;
    event.preventDefault();
    openSiteGuide();
  });
}

/* STREAK SUMMARY: Lets students tap the dashboard streak for a compact study pulse. */
function openStreakSummary() {
  if (getElement("#streakSummaryModal")) return;

  const summary = getStudySummary();
  const streak = Number(summary.streak || 0);
  const weakTopics = summary.weakTopics || [];
  const level = getStreakFireLevel(streak);
  const message =
    streak >= 7
      ? "Strong run. Keep it steady and protect the habit."
      : streak >= 3
        ? "The rhythm is forming. One focused session today keeps it alive."
        : streak >= 1
          ? "Good start. Come back tomorrow and let it become a pattern."
          : "Start with one quiz or one reader session. The streak begins from action.";

  const overlay = document.createElement("section");
  overlay.id = "streakSummaryModal";
  overlay.className = "edit-modal streak-summary-modal";
  overlay.innerHTML = `
    <article class="edit-card streak-summary-card">
      <header>
        <div>
          <p class="eyebrow">Study pulse</p>
          <h2>Your streak is ${streak} day${streak === 1 ? "" : "s"}</h2>
          <p class="form-help">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="icon-button" data-close-edit aria-label="Close streak summary">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="streak-summary-visual" data-level="${level}">
        <span class="streak-orb" aria-hidden="true">
          <i class="fire-streak"></i>
          <i class="streak-spark streak-spark-one"></i>
          <i class="streak-spark streak-spark-two"></i>
        </span>
        <strong>${streak}</strong>
        <small>day streak</small>
      </div>
      <div class="streak-summary-grid">
        <article>
          <strong>${weakTopics.length}</strong>
          <small>weak topic${weakTopics.length === 1 ? "" : "s"} to repair</small>
        </article>
        <article>
          <strong>${streak ? "Active" : "Ready"}</strong>
          <small>${streak ? "study rhythm" : "start today"}</small>
        </article>
      </div>
      <div class="guide-actions">
        <a class="primary-action" href="./quiz.html"><span class="material-symbols-rounded" aria-hidden="true">quiz</span>Take a quiz</a>
        <a class="secondary-action" href="./exam-room.html"><span class="material-symbols-rounded" aria-hidden="true">timer</span>Exam room</a>
      </div>
    </article>
  `;

  document.body.appendChild(overlay);
  updateStreakFire(streak);
  overlay.querySelector("[data-close-edit]")?.addEventListener("click", closeEditModal);
}

function connectStreakSummary() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-streak-summary]");
    if (!button) return;
    event.preventDefault();
    openStreakSummary();
  });
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
    if (refreshedSession) {
      showToast("Could not verify your profile. Cached data is shown.", "warning");
      setMemberGate(false);
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
      <details class="signin-help" id="memberSigninHelp" hidden>
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
        <a class="signin-support-link external-link" href="https://wa.link/757ou3" target="_blank" rel="noopener">
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
  const signinHelp = getElement("#memberSigninHelp");

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
      await ensureBirthdayOnboarding();
      renderBirthdayPhotoSettings();
    } catch (error) {
      status.textContent = error.message || "Could not save profile. Please try again.";
      if (signinHelp) {
        signinHelp.hidden = false;
        signinHelp.open = true;
      }
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
  if (timetableCount) timetableCount.textContent = formatCountdownParts(getResumptionDate())[0].value;
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
      <div class="card-action-group">
        <a class="card-action" href="${escapeHtml(resourceUrl)}">
          <span class="material-symbols-rounded" aria-hidden="true">chrome_reader_mode</span>
          Read inside
        </a>
        ${resource.downloadUrl && resource.fileName ? `
        <button class="card-action" type="button" data-download-resource="${escapeHtml(resource.id)}">
          <span class="material-symbols-rounded" aria-hidden="true">download</span>
          Download
        </button>` : ""}
      </div>
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
  const canDownload = resource.downloadUrl && resource.fileName;
  return `
    <article class="course-resource-item">
      <div>
        <h4>${escapeHtml(resource.title)}</h4>
        <p>${escapeHtml(resource.note || resource.fileName || "Uploaded class material")}</p>
        ${resourceEngagementRow(resource)}
      </div>
      <div class="card-action-group">
        <a class="card-action" href="${escapeHtml(resourceUrl)}">
          <span class="material-symbols-rounded" aria-hidden="true">chrome_reader_mode</span>
          Read
        </a>
        ${canDownload ? `
        <button class="card-action" type="button" data-download-resource="${escapeHtml(resource.id)}">
          <span class="material-symbols-rounded" aria-hidden="true">download</span>
          Download
        </button>` : ""}
      </div>
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
  const courseSchedule = MOCK_SCHEDULE.filter((item) => item.course_code === course.code);
  const activeTab = state.activeCourseTab || "overview";
  if (!state.activeCourseTab) state.activeCourseTab = "overview";

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

      <nav class="course-hub-tabs" data-course-tabs aria-label="Course hub sections">
        <button class="hub-tab ${activeTab === "overview" ? "active" : ""}" data-tab="overview">Overview</button>
        <button class="hub-tab ${activeTab === "lectures" ? "active" : ""}" data-tab="lectures">Weekly Lectures</button>
        <button class="hub-tab ${activeTab === "resources" ? "active" : ""}" data-tab="resources">Resources</button>
        <button class="hub-tab ${activeTab === "past-questions" ? "active" : ""}" data-tab="past-questions">Past Questions</button>
        <button class="hub-tab ${activeTab === "quiz" ? "active" : ""}" data-tab="quiz">Quiz</button>
        <button class="hub-tab ${activeTab === "announcements" ? "active" : ""}" data-tab="announcements">Announcements</button>
      </nav>

      <div class="course-hub-content">
        ${renderHubTabContent(activeTab, course, resources, grouped, groupOrder, courseSchedule)}
      </div>
    </section>
  `;

  const hubSection = grid.querySelector(".course-detail");
  if (hubSection) {
    hubSection.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab) return;
      state.activeCourseTab = tab.dataset.tab;
      renderCourseDetail(grid, course, resources);
    });
  }
}

const TOTAL_WEEKS = 13;
const SEMESTER_START = new Date("2026-02-15");

function weekStartDate(weekNum) {
  const d = new Date(SEMESTER_START);
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  return d;
}

function weekDateRange(weekNum) {
  const start = weekStartDate(weekNum);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const fmt = (dt) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function generateWeeklyLectures(courseCode) {
  const slots = MOCK_SCHEDULE.filter((s) => s.course_code === courseCode);
  if (!slots.length) return [];
  const lectures = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    slots.forEach((slot) => {
      const slidesUp = w <= 6 ? slot.slides_available : (w <= 10 ? Math.random() > 0.3 : Math.random() > 0.5);
      const quizUp  = slidesUp && (w <= 4 ? slot.quiz_available : Math.random() > 0.6);
      lectures.push({
        week: w,
        day: slot.day,
        start_time: slot.start_time,
        end_time: slot.end_time,
        venue: slot.venue,
        lecturer: slot.lecturer,
        course_title: slot.course_title,
        slides_available: slidesUp,
        quiz_available: quizUp,
      });
    });
  }
  return lectures;
}

function renderHubTabContent(tab, course, resources, grouped, groupOrder, courseSchedule) {
  switch (tab) {
    case "overview":
      return `
        <section class="hub-overview">
          <div class="hub-overview-card">
            <h3>About this course</h3>
            <p><strong>Code:</strong> ${escapeHtml(course.code)}</p>
            <p><strong>Title:</strong> ${escapeHtml(course.title)}</p>
            <p><strong>Type:</strong> ${escapeHtml(course.type)}</p>
            <p><strong>Units:</strong> ${course.units}</p>
            <p><strong>Resources:</strong> ${resources.length} posted</p>
          </div>
          <div class="hub-overview-card">
            <h3>Quick actions</h3>
            <div class="hub-quick-actions">
              <a class="secondary-action" href="./quiz.html?course=${encodeURIComponent(course.code)}">
                <span class="material-symbols-rounded" aria-hidden="true">quiz</span>Practice quiz
              </a>
              ${courseSchedule.length ? `<button class="secondary-action" type="button" data-tab="lectures"><span class="material-symbols-rounded" aria-hidden="true">event</span>View schedule</button>` : ""}
            </div>
          </div>
        </section>
      `;

    case "lectures": {
      const weeklyLectures = generateWeeklyLectures(course.code);
      if (!weeklyLectures.length) {
        return `<p class="empty-group">No lecture schedule available for this course yet.</p>`;
      }
      const weekGroups = {};
      weeklyLectures.forEach((lec) => {
        if (!weekGroups[lec.week]) weekGroups[lec.week] = [];
        weekGroups[lec.week].push(lec);
      });
      const weekNums = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `
        <div class="hub-lectures">
          ${weekNums.map((wk) => {
            const lecs = weekGroups[wk].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.start_time.localeCompare(b.start_time));
            const dateRange = weekDateRange(wk);
            return `
              <section class="lecture-week-group">
                <div class="lecture-week-header">
                  <span class="lecture-week-badge">Week ${wk}</span>
                  <span class="lecture-week-date">${dateRange}</span>
                </div>
                ${lecs.map((lec) => `
                  <div class="hub-lecture-card">
                    <div class="lecture-day-badge">${lec.day.slice(0, 3).toUpperCase()}</div>
                    <div class="lecture-card-body">
                      <div class="lecture-card-top">
                        <strong>${escapeHtml(lec.course_title)}</strong>
                        <span class="lecture-time">${lec.start_time.slice(0, 5)} – ${lec.end_time.slice(0, 5)}</span>
                      </div>
                      <small class="lecture-venue">${escapeHtml(lec.venue)}</small>
                      <div class="lecture-status-row">
                        <span class="lecture-status-badge ${lec.slides_available ? "badge-ok" : "badge-missing"}">
                          <span class="material-symbols-rounded" aria-hidden="true">${lec.slides_available ? "check_circle" : "pending"}</span>
                          ${lec.slides_available ? "Slides" : "Slides missing"}
                        </span>
                        <span class="lecture-status-badge ${lec.quiz_available ? "badge-ok" : "badge-later"}">
                          <span class="material-symbols-rounded" aria-hidden="true">${lec.quiz_available ? "check_circle" : "hourglass_top"}</span>
                          ${lec.quiz_available ? "Quiz" : "Quiz later"}
                        </span>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </section>
            `;
          }).join("")}
        </div>
      `;
    }

    case "resources":
      return `
        <div class="course-resource-groups">
          ${groupOrder.map((group) => {
            const groupItems = grouped[group] || [];
            return `
              <section class="course-resource-group">
                <div class="group-heading">
                  <h3>${group}</h3>
                  <span>${groupItems.length}</span>
                </div>
                ${groupItems.length ? groupItems.map(courseResourceItem).join("") : `<p class="empty-group">Nothing posted here yet.</p>`}
              </section>
            `;
          }).join("")}
        </div>
      `;

    case "past-questions": {
      const pqItems = grouped["Past Questions"] || [];
      return `
        <div class="course-resource-groups">
          <section class="course-resource-group">
            <div class="group-heading">
              <h3>Past Questions</h3>
              <span>${pqItems.length}</span>
            </div>
            ${pqItems.length ? pqItems.map(courseResourceItem).join("") : `<p class="empty-group">No past questions uploaded yet. Check back during revision season.</p>`}
          </section>
        </div>
      `;
    }

    case "quiz":
      return `
        <div class="hub-quiz-panel">
          <h3>Test your knowledge</h3>
          <p>Practice with quiz questions tailored for ${escapeHtml(course.title)}.</p>
          <div class="hub-quick-actions">
            <a class="primary-action" href="./quiz.html?course=${encodeURIComponent(course.code)}">
              <span class="material-symbols-rounded" aria-hidden="true">quiz</span>Start quiz
            </a>
            <a class="secondary-action" href="./exam-room.html?course=${encodeURIComponent(course.code)}">
              <span class="material-symbols-rounded" aria-hidden="true">timer</span>Exam room
            </a>
          </div>
        </div>
      `;

    case "announcements": {
      const courseAnnouncements = state.announcements.filter((a) => a.courseCode === course.code);
      return `
        <div class="hub-announcements">
          ${courseAnnouncements.length ? courseAnnouncements.map((a) => `
            <div class="hub-announcement-item">
              <strong>${escapeHtml(a.title)}</strong>
              <p>${escapeHtml(a.body)}</p>
              <small>${formatDate(a.createdAtMs)}</small>
            </div>
          `).join("") : `<p class="empty-group">No announcements for this course yet.</p>`}
        </div>
      `;
    }

    default:
      return `<p class="empty-group">Select a tab above.</p>`;
  }
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
          <h3>${isSupabaseConfigured() ? "Waiting for course reps" : "Portal connection needed"}</h3>
          <p>${
            isSupabaseConfigured()
              ? "New slides and materials will appear here once they are posted."
              : "Live resources are not connected yet. Ask the portal admin to finish setup."
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
function renderCourseGrid(filteredCourses) {
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

  const courses = filteredCourses || firstSemesterCourses;
  if (count) count.textContent = `${courses.length} course${courses.length === 1 ? "" : "s"}`;

  grid.innerHTML = courses
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

/* RESUMPTION PAGE: Replaces the finished exam timetable with a calm second-semester countdown. */
function renderTimetable() {
  const container = getElement("#lectureTimetable") || getElement("#practicalTimetable");
  if (!container) return;

  const now = new Date();
  const resumptionDate = getResumptionDate();
  const hasResumed = now >= resumptionDate;
  const countdownParts = formatCountdownParts(resumptionDate, now);

  const count = getElement("#timetablePageCount");
  if (count) count.textContent = hasResumed ? "Second semester has resumed" : `${countdownParts[0].value} days left`;
}

/* NEXT STEP CARD: Keeps the dashboard focused on resumption after exams. */
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

async function loadStudyGuideData() {
  if (document.body.dataset.page !== "exam" || state.studyGuide.length) return;
  const summary = getElement("#studyGuideSummary");
  if (summary) summary.innerHTML = `<p class="eyebrow">Study guide</p><h2>Guide is still loading...</h2>`;

  try {
    const response = await fetch("./bio-study-guide.json?v=20260709-1", { cache: "no-store" });
    if (!response.ok) throw new Error("Study guide data is not available yet.");
    const guide = await response.json();
    state.studyGuide = Array.isArray(guide) ? guide : [];
  } catch (error) {
    console.warn(error);
    if (summary) summary.innerHTML = `<p class="eyebrow">Study guide</p><h2>Error loading guide</h2><p>Please refresh the page.</p>`;
    state.studyGuide = [];
  }
}

function splitDefinitionLine(line = "") {
  const [term, ...rest] = String(line).split(":");
  return {
    term: stripSiteEmoji(term || "Key idea"),
    meaning: stripSiteEmoji(rest.join(":") || line),
  };
}

function studyGuideTopic() {
  return (
    studyGuideTopicsForCourse().find((topic) => topic.topic === state.selectedStudyGuideTopic) ||
    studyGuideTopicsForCourse()[0] ||
    null
  );
}

function studyGuideTopicsForCourse(courseCode = state.selectedStudyGuideCourse) {
  return state.studyGuide.filter((topic) => topic.courseCode === courseCode);
}

function studyList(items = [], tone = "default") {
  const cleanItems = items.map(stripSiteEmoji).filter(Boolean);
  if (!cleanItems.length) return "";
  return `
    <ul class="smart-list" data-tone="${tone}">
      ${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

async function buildFlashcards(topic) {
  const courseCode = topic?.courseCode || state.selectedStudyGuideCourse;
  if (!courseCode) return [];

  // 1. Check for flashcards in the study guide data itself first (high priority)
  const guideFlashcards = topic?.flashcards || [];
  if (guideFlashcards.length > 0) return guideFlashcards;

  // 2. Check the cache
  if (state.studyGuideFlashcardCache[courseCode]) {
    return state.studyGuideFlashcardCache[courseCode];
  }

  // 3. Fetch from content/<courseCode>/flashcards.json
  try {
    const response = await fetch(`./content/${courseCode}/flashcards.json`, { cache: "force-cache" });
    if (!response.ok) throw new Error("No flashcards file");
    const data = await response.json();
    const cards = Array.isArray(data) ? data : (data.flashcards || []);
    
    state.studyGuideFlashcardCache[courseCode] = cards;
    return cards;
  } catch (e) {
    console.warn(`Failed to load flashcards for ${courseCode}:`, e);
    return [];
  }
}

function guideResourceMatches(topic) {
  const courseCode = topic?.courseCode || state.selectedStudyGuideCourse || firstSemesterCourses[0]?.code || "";
  const keywords = [
    topic?.topic,
    ...(topic?.subtopics || []).map((subtopic) => subtopic.title),
    courseCode,
  ]
    .map((item) => String(item || "").toLowerCase())
    .filter(Boolean);

  return state.resources
    .filter((resource) => resource.courseCode === courseCode)
    .filter((resource) => {
      const haystack = `${resource.title} ${resource.note || ""} ${resource.fileName || ""}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword.split(" ")[0]));
    })
    .slice(0, 6);
}

async function renderExamMode() {
  const courseSelect = getElement("#studyGuideCourseSelect");
  const topicList = getElement("#studyGuideTopicList");
  const summary = getElement("#studyGuideSummary");
  const flashcards = getElement("#studyGuideFlashcards");
  const subtopics = getElement("#studyGuideSubtopics");
  const sources = getElement("#studyGuideSources");
  if (!topicList || !summary || !flashcards || !subtopics || !sources) return;

  if (courseSelect && !courseSelect.dataset.ready) {
    courseSelect.innerHTML = firstSemesterCourses
      .map(
        (course) =>
          `<option value="${escapeHtml(course.code)}" ${course.code === state.selectedStudyGuideCourse ? "selected" : ""}>${escapeHtml(
            `${course.code} - ${course.title}`
          )}</option>`
      )
      .join("");
    courseSelect.dataset.ready = "true";
  }

  if (!state.studyGuide.length) {
    summary.innerHTML = `
      <p class="eyebrow">Study guide</p>
      <h2>Guide is still loading</h2>
      <p>Your study guide will appear here once a study outline is available.</p>
    `;
    topicList.innerHTML = "";
    flashcards.innerHTML = "";
    subtopics.innerHTML = "";
    sources.innerHTML = `<a class="source-link-card" href="./courses.html">Browse all course resources</a>`;
    return;
  }

  const course = findCourse(state.selectedStudyGuideCourse) || {
    code: state.selectedStudyGuideCourse,
    title: state.selectedStudyGuideCourse,
  };
  const courseTopics = studyGuideTopicsForCourse();
  if (!courseTopics.length) {
    topicList.innerHTML = `<div class="empty-state">No structured guide for this course yet.</div>`;
    summary.innerHTML = `
      <p class="eyebrow">${escapeHtml(course.code)} guide</p>
      <h2>${escapeHtml(course.title)}</h2>
      <p>
        A smart breakdown has not been added for this course yet. You can still use the uploaded materials and quiz bank while we build the guide.
      </p>
      <div class="smart-summary-actions">
        <a class="secondary-action" href="./courses.html?course=${encodeURIComponent(course.code)}">
          <span class="material-symbols-rounded" aria-hidden="true">menu_book</span>
          Open resources
        </a>
        <a class="secondary-action" href="./quiz.html">
          <span class="material-symbols-rounded" aria-hidden="true">quiz</span>
          Practise questions
        </a>
      </div>
    `;
    flashcards.innerHTML = `<p class="empty-state">Flashcards will appear after a structured guide is added for ${escapeHtml(course.code)}.</p>`;
    subtopics.innerHTML = "";
    const courseResources = state.resources.filter((resource) => resource.courseCode === course.code).slice(0, 6);
    sources.innerHTML = [
      `<a class="source-link-card" href="./courses.html?course=${encodeURIComponent(course.code)}">
        <span class="material-symbols-rounded" aria-hidden="true">menu_book</span>
        <strong>Open ${escapeHtml(course.code)} course page</strong>
        <small>Read or download the uploaded class materials for this course.</small>
      </a>`,
      ...courseResources.map(
        (resource) => `
          <a class="source-link-card" href="${escapeHtml(resourceReaderLink(resource))}">
            <span class="material-symbols-rounded" aria-hidden="true">description</span>
            <strong>${escapeHtml(resource.title)}</strong>
            <small>${escapeHtml(resource.note || resource.fileName || `${course.code} material`)}</small>
          </a>
        `
      ),
    ].join("");
    return;
  }

  if (!courseTopics.some((item) => item.topic === state.selectedStudyGuideTopic)) {
    state.selectedStudyGuideTopic = courseTopics[0].topic;
  }
  const topic = studyGuideTopic();
  topicList.innerHTML = courseTopics
    .map(
      (item, index) => `
        <button class="smart-topic-button" type="button" data-study-topic="${escapeHtml(item.topic)}" data-active="${
        item.topic === topic.topic
      }">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(item.topic)}</strong>
      </button>
    `
    )
    .join("");

  const topicCourse = findCourse(topic.courseCode) || { code: topic.courseCode, title: topic.courseCode };
  summary.innerHTML = `
    <p class="eyebrow">${escapeHtml(topicCourse.code)} guide</p>
    <h2>${escapeHtml(topic.topic)}</h2>
    <p>${escapeHtml(topic.summary || "A focused breakdown of this topic.")}</p>
    <div class="smart-summary-actions">
      <a class="secondary-action" href="./quiz.html">
        <span class="material-symbols-rounded" aria-hidden="true">quiz</span>
        Practise questions
      </a>
      <a class="secondary-action" href="./courses.html?course=${encodeURIComponent(topic.courseCode || state.selectedStudyGuideCourse)}">
        <span class="material-symbols-rounded" aria-hidden="true">menu_book</span>
        Find slides
      </a>
    </div>
  `;

  flashcards.innerHTML = `<div class="loading-state"><span class="material-symbols-rounded">hourglass_empty</span><p>Loading flashcards...</p></div>`;
  subtopics.innerHTML = (topic.subtopics || [])
    .map(
      (subtopic, index) => `
        <article class="smart-subtopic-card">
          <header>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div>
              <p class="eyebrow">Study block</p>
              <h3>${escapeHtml(subtopic.title)}</h3>
            </div>
          </header>
          <div class="smart-subtopic-grid">
            <section>
              <h4>Understand it like this</h4>
              ${studyList(subtopic.keyPoints || [], "learn")}
            </section>
            <section>
              <h4>Must know</h4>
              ${studyList(subtopic.mustKnow || [], "must")}
            </section>
            <section>
              <h4>Exam traps</h4>
              ${studyList(subtopic.examTraps || [], "trap")}
            </section>
            <section>
              <h4>Possible question angles</h4>
              ${studyList(subtopic.possibleQuestionPoints || [], "question")}
            </section>
          </div>
        </article>
      `
    )
    .join("");

  const matchedResources = guideResourceMatches(topic);
  sources.innerHTML = [
    `<a class="source-link-card" href="./courses.html?course=${encodeURIComponent(topic.courseCode || state.selectedStudyGuideCourse)}">
      <span class="material-symbols-rounded" aria-hidden="true">menu_book</span>
      <strong>Open ${escapeHtml(topic.courseCode || state.selectedStudyGuideCourse)} course page</strong>
      <small>Use the search bar to find the matching slide or compiled note.</small>
    </a>`,
    ...matchedResources.map(
      (resource) => `
        <a class="source-link-card" href="${escapeHtml(resourceReaderLink(resource))}">
          <span class="material-symbols-rounded" aria-hidden="true">description</span>
          <strong>${escapeHtml(resource.title)}</strong>
          <small>${escapeHtml(resource.note || resource.fileName || resource.title || "Course material")}</small>
        </a>
      `
    ),
  ].join("");

  const cards = await buildFlashcards(topic);
  if (state.studyGuideFlashcardIndex >= cards.length) state.studyGuideFlashcardIndex = 0;
  const activeCard = cards[state.studyGuideFlashcardIndex];
  flashcards.innerHTML = activeCard
    ? `
      <div class="flashcard-stage">
        <button class="study-flashcard" type="button" data-flashcard>
          <span>${escapeHtml(activeCard.label)}</span>
          <strong data-front>${escapeHtml(activeCard.front)}</strong>
          <small data-back>${escapeHtml(activeCard.back)}</small>
          <em>Tap to reveal</em>
        </button>
        <div class="flashcard-controls" aria-label="Flashcard controls">
          <button class="mini-action" type="button" data-flashcard-nav="prev">
            <span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>
            Previous
          </button>
          <span>${state.studyGuideFlashcardIndex + 1} of ${cards.length}</span>
          <button class="mini-action" type="button" data-flashcard-nav="next">
            Next
            <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </div>
    `
    : `<p class="empty-state">No flashcards have been added for this topic yet.</p>`;
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

  const isNarrow = window.innerWidth <= 760;
  const visibleLimit = isDashboardPage() ? (isNarrow ? 4 : 8) : 12;
  const totalItems = items.length;
  const hasMore = totalItems > visibleLimit;
  list.dataset.showAll = "false";

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
    .join("") + (hasMore ? `<button class="ghost-link" type="button" data-show-all-notifications style="justify-self:center;margin-top:8px">View all ${totalItems} notifications</button>` : "");
}

function renderTopicTracker(summary = getStudySummary()) {
  const target = getElement("#studentTopicTracker");
  if (!target) return;

  const weakTopics = summary.weakTopics || [];
  if (!weakTopics.length && !summary.strongTopics?.length && isDashboardPage()) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }

  target.hidden = false;
  const strongTopics = summary.strongTopics || [];
  const chips = [
    ...weakTopics.map(
      (topic) => `
        <article class="topic-chip">
          <strong>${escapeHtml(topic.courseCode || "Course")}</strong>
          <span>${escapeHtml(topic.topic || "General")}</span>
          <small>${Number(topic.accuracy || 0)}% accuracy</small>
        </article>
      `
    ),
    ...strongTopics.map(
      (topic) => `
        <article class="topic-chip" data-tone="clear">
          <strong>${escapeHtml(topic.courseCode || "Course")}</strong>
          <span>${escapeHtml(topic.topic || "General")}</span>
          <small>${Number(topic.accuracy || 0)}% — going well</small>
        </article>
      `
    ),
  ];
  target.innerHTML = chips.length
    ? chips.join("")
    : `<article class="topic-chip" data-tone="clear">
        <strong>Clear board</strong>
        <span>Topics will appear after quizzes.</span>
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
  const hasAnyData = Object.keys(courses).length > 0;
  const available = firstSemesterCourses.filter((course) => courses[course.code]?.count);

  if (hasAnyData && !available.length) {
    courseSelect.innerHTML = `<option value="">Question bank is being populated for your courses</option>`;
    courseSelect.disabled = true;
  } else if (available.length) {
    courseSelect.innerHTML = available
      .map(
        (course) =>
          `<option value="${course.code}">${course.code} - ${escapeHtml(course.title)}</option>`
      )
      .join("");
    courseSelect.disabled = false;
  } else {
    courseSelect.innerHTML = `<option value="">Practice questions are not ready yet</option>`;
    courseSelect.disabled = true;
  }
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
  renderQuizBankStatus();
}

function renderQuizBankStatus() {
  const status = getElement("#quizStatus");
  const setupForm = getElement("#quizSetupForm");
  const courseSelect = getElement("#quizCourseSelect");
  if (!setupForm) return;

  const courses = state.study.setup?.courses || {};
  const hasQuestions = Object.values(courses).some((c) => Number(c.count) > 0);

  if (!hasQuestions && courseSelect?.disabled !== false) {
    if (status) {
      status.textContent = "The question bank is being updated. Check back soon for practice questions.";
      status.style.color = "var(--muted)";
    }
    const submitBtn = setupForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  } else if (hasQuestions) {
    if (status) {
      status.textContent = "";
      status.style.color = "";
    }
    const submitBtn = setupForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
    if (courseSelect) courseSelect.disabled = false;
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

  const questions = state.study.questions || [];
  const total = questions.length;
  const currentIndex = Math.max(0, Math.min(Number(state.study.currentIndex || 0), Math.max(0, total - 1)));
  state.study.currentIndex = currentIndex;
  const question = questions[currentIndex];
  const answeredCount = questions.filter((item) => state.study.answers?.[item.id]).length;
  const progressPercent = total ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  if (title) title.textContent = state.study.mode === "exam" ? "Simulated exam attempt" : "Practice questions";
  if (meta) meta.textContent = `${quizModeLabel(state.study.mode)} - ${state.study.courseCode || ""}`;
  document.body.dataset.quizFocus = "active";
  panel.hidden = false;
  if (resultPanel) resultPanel.hidden = true;

  if (!question) {
    form.innerHTML = `<p class="form-help">No question is ready for this attempt.</p>`;
    return;
  }

  form.innerHTML = `
    <div class="quiz-attempt-bar">
      <button class="ghost-action quiz-exit-action" type="button" data-exit-quiz>
        <span class="material-symbols-rounded" aria-hidden="true">close</span>
        Exit ${state.study.mode === "exam" ? "exam mode" : "quiz"}
      </button>
      <span>${escapeHtml(state.study.courseCode || "Course")}${state.study.topic ? ` - ${escapeHtml(state.study.topic)}` : ""}</span>
    </div>
    <div class="quiz-progress-row" aria-live="polite">
      <span>Question ${currentIndex + 1} of ${total}</span>
      <small>${answeredCount} answered</small>
    </div>
    <div class="quiz-progress-track" aria-hidden="true"><span style="width: ${progressPercent}%"></span></div>
    <fieldset class="quiz-question-card" data-focused="true">
      <legend>
        <span>Question ${currentIndex + 1}</span>
        <small>${escapeHtml(question.topic || "General")} - ${escapeHtml(question.difficulty || "Medium")}</small>
      </legend>
      <p>${escapeHtml(polishQuestionText(question.question))}</p>
      <div class="quiz-options">
        ${(question.options || [])
          .map((option) => {
            const selected = state.study.answers?.[question.id] === option;
            return `
              <label data-selected="${selected ? "true" : "false"}">
                <input
                  type="radio"
                  name="question-${question.id}"
                  value="${escapeHtml(option)}"
                  ${selected ? "checked" : ""}
                />
                <span>${escapeHtml(option)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    </fieldset>
    <div class="quiz-nav-actions">
      <button class="secondary-action" type="button" data-quiz-nav="prev" ${currentIndex === 0 ? "disabled" : ""}>
        Previous
      </button>
      <button class="secondary-action" type="button" data-quiz-nav="next" ${currentIndex >= total - 1 ? "disabled" : ""}>
        Next question
      </button>
      <button class="primary-action" type="button" data-review-submit>
        Review and submit
      </button>
    </div>
  `;
}

function renderQuizResults(data) {
  const panel = getElement("#quizResultPanel");
  if (!panel) return;

  document.body.dataset.quizFocus = "result";
  const playerPanel = getElement("#quizPlayerPanel");
  if (playerPanel) playerPanel.hidden = true;

  const percent = data.total ? Math.round((Number(data.score || 0) / Number(data.total)) * 100) : 0;
  const total = Number(data.total || 0);
  const score = Number(data.score || 0);
  const missed = Math.max(0, total - score);
  const unanswered = (data.results || []).filter((result) => !result.selectedAnswer).length;
  const questionTopics = new Map((state.study.questions || []).map((question) => [String(question.id), question.topic]));
  const weakTopics = (data.results || [])
    .filter((result) => !result.correct)
    .reduce((topics, result) => {
      const topic = result.topic || questionTopics.get(String(result.questionId)) || "General";
      topics.set(topic, (topics.get(topic) || 0) + 1);
      return topics;
    }, new Map());
  const focusTopics = [...weakTopics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  const strongTopics = (data.results || [])
    .filter((result) => result.correct)
    .reduce((topics, result) => {
      const topic = result.topic || questionTopics.get(String(result.questionId)) || "General";
      topics.set(topic, (topics.get(topic) || 0) + 1);
      return topics;
    }, new Map());
  const topStrong = [...strongTopics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([topic]) => topic);

  panel.hidden = false;
  panel.innerHTML = `
    <div class="section-header">
      <div>
        <p class="eyebrow">Attempt complete</p>
        <h2>${percent}% score</h2>
      </div>
      <span class="soft-pill">${score} of ${total}</span>
    </div>
    <p class="result-motivation">${escapeHtml(data.motivation || "Attempt saved. Review your misses and try again.")}</p>
    <div class="result-insight-grid">
      <article>
        <strong>${score}</strong>
        <span>correct</span>
      </article>
      <article>
        <strong>${missed}</strong>
        <span>to review</span>
      </article>
      <article>
        <strong>${formatDuration(Math.floor((Date.now() - state.study.startedAt) / 1000))}</strong>
        <span>time spent</span>
      </article>
    </div>
    <div class="result-focus-note">
      <strong>Focus next:</strong>
      <span>${
        focusTopics.length
          ? escapeHtml(focusTopics.join(", "))
          : unanswered
            ? "Answer every question before submitting next time."
            : "You kept this attempt clean. Push into a harder set next."
      }</span>
      ${topStrong.length ? `<br><strong>Going well:</strong> <span>${escapeHtml(topStrong.join(", "))}</span>` : ""}
    </div>
    <div class="quiz-review-list">
      ${(data.results || [])
        .map(
          (result) => `
            <article class="quiz-review-card" data-correct="${result.correct ? "true" : "false"}">
              <strong>${escapeHtml(polishQuestionText(result.question))}</strong>
              <p>Your answer: ${escapeHtml(result.selectedAnswer || "No answer")}</p>
              <p>Correct answer: ${escapeHtml(result.correctAnswer || "")}</p>
              <small>${escapeHtml(polishedExplanationText(result))}</small>
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

function canEditResource(resource) { /* stub — moved to executive.v20260717-1.js */ }

function canEditAnnouncement(announcement) { /* stub — moved to executive.v20260717-1.js */ }

function isAdminPortal() {
  return document.body.dataset.portalRole === "admin";
}

function renderMembersTable() { /* stub — moved to executive.v20260717-1.js */ }

function renderStaffLists() { /* stub — moved to executive.v20260717-1.js */ }

/* ADMIN DASHBOARD: Card-based landing with welcome greeting, summary metrics, site usage, and streak leaderboard. */
function renderAdminDashboard() { /* stub — moved to executive.v20260717-1.js */ }

function renderStaffSummary() { /* stub — moved to executive.v20260717-1.js */ }

/* STAFF MONITOR: Resource analytics — per-course counts, recent uploads, top engaged resources. */
function renderStaffMonitor() { /* stub — moved to executive.v20260717-1.js */ }

function renderStaffStudyFilters() { /* stub — moved to executive.v20260717-1.js */ }

function renderMemberStudyHistory(memberId = state.staffStudySelectedMemberId) { /* stub — moved to executive.v20260717-1.js */ }

function renderStaffStudyAnalytics() { /* stub — moved to executive.v20260717-1.js */ }

function renderAll() {
  renderSiteCredit();
  renderScholarGreeting();
  renderInstallPrompt();
  renderNotificationSetup();
  renderBirthdayPhotoSettings();
  renderDashboardMetrics();
  renderResourceCards();
  renderCourseGrid();
  renderTimetable();
  if (typeof renderNextExam === "function") renderNextExam();
  if (typeof renderGesCountdown === "function") renderGesCountdown();
  renderExamMode();
  renderNotificationCenter();
  renderAnnouncements();
  renderStudyDashboard();
  renderNextLecture();
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



/* NEXT LECTURE: Dashboard card showing the upcoming class with countdown + slide status. */
function renderNextLecture() {
  const card = getElement("#nextLectureCard");
  const titleEl = getElement("#nextLectureTitle");
  const timeEl = getElement("#nextLectureTime");
  const timerEl = getElement("#nextLectureTimer");
  const venueEl = getElement("#nextLectureVenue");
  const statusEl = getElement("#nextLectureStatus");
  if (!card || !titleEl) return;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const todayName = days[now.getDay()];

  const todaySchedule = MOCK_SCHEDULE.filter((item) => {
    const itemDay = days.indexOf(item.day);
    const itemDate = new Date(now);
    itemDate.setDate(now.getDate() + (itemDay - now.getDay() + 7) % 7);
    const [h, m, s] = item.start_time.split(":").map(Number);
    itemDate.setHours(h, m, s, 0);
    return item.day === todayName && itemDate > now;
  });

  let nextItem = todaySchedule.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];

  if (!nextItem) {
    for (let offset = 1; offset <= 7; offset++) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + offset);
      const nextDayName = days[nextDate.getDay()];
      const nextDaySchedule = MOCK_SCHEDULE.filter((item) => item.day === nextDayName);
      if (nextDaySchedule.length) {
        nextItem = nextDaySchedule.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
        nextItem._targetDate = nextDate;
        break;
      }
    }
  }

  if (!nextItem) {
    card.hidden = true;
    return;
  }

  const itemDay = days.indexOf(nextItem.day);
  const targetDate = nextItem._targetDate || new Date(now);
  if (!nextItem._targetDate) {
    targetDate.setDate(now.getDate() + (itemDay - now.getDay() + 7) % 7);
  }
  const [h, m, s] = nextItem.start_time.split(":").map(Number);
  targetDate.setHours(h, m, s, 0);

  const diff = Math.max(0, Math.floor((targetDate - now) / 1000));
  const hrs = String(Math.floor(diff / 3600)).padStart(2, "0");
  const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const secs = String(diff % 60).padStart(2, "0");

  card.hidden = false;
  titleEl.textContent = `${nextItem.course_code} - ${nextItem.course_title}`;
  timeEl.textContent = `${nextItem.start_time.slice(0, 5)} - ${nextItem.end_time.slice(0, 5)}`;
  if (venueEl) venueEl.textContent = nextItem.venue;
  timerEl.textContent = `${hrs}:${mins}:${secs}`;

  if (statusEl) {
    if (nextItem.slides_available) {
      statusEl.innerHTML = '<span class="tt-badge">Slides Available</span>';
    } else {
      statusEl.innerHTML = '<span class="tt-badge missing">Slides not uploaded</span>';
    }
    if (nextItem.quiz_available) {
      statusEl.innerHTML += '<span class="tt-badge">Quiz Ready</span>';
    }
  }
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

function findPossibleDuplicate({ courseCode, title, file }) { /* stub — moved to executive.v20260717-1.js */ }

function safeZipEntryName(value = "resource") {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200) || "resource";
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
    const originalName = resource.fileName || `${resource.title}.pdf`;
    const fileName = uniqueZipName(usedNames, originalName);
    entries[fileName] = bytes;
  }

  const zipped = zipSync(entries, { level: 6 });
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const zipName = `${course?.code || courseCode} ${course?.title || "resources"}.zip`;
  link.download = safeZipEntryName(zipName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  if (status) status.textContent = "Course ZIP downloaded.";
}

/* INDIVIDUAL RESOURCE DOWNLOAD: Fetches a single resource and saves it with its original filename. */
async function downloadIndividualResource(resourceId) {
  const resource = state.resources.find((r) => r.id === resourceId);
  if (!resource || !resource.downloadUrl) {
    showToast("This resource cannot be downloaded.", "error");
    return;
  }

  const fileName = resource.fileName || `${resource.title || "resource"}.pdf`;
  const response = await fetch(resource.downloadUrl);
  if (!response.ok) throw new Error(`Could not download ${resource.title}.`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(`Downloading ${fileName}`);
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
    return "The email or password was not accepted. Re-enter both carefully, then try again.";
  }
  if (message.includes("email not confirmed")) {
    return "This staff account exists, but the email has not been confirmed yet.";
  }
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("timeout")) {
    return "The portal could not reach the class system. Check the connection and try again.";
  }
  return error.message || "Could not sign in.";
}

function setStaffDiagnostic(element, message, tone = "muted") {
  if (!element) return;
  element.dataset.tone = tone;
  element.textContent = message;
}

/* REP/ADMIN AUTH: Protects staff portals through Supabase Auth + staff_roles table. */
function connectStaffPortal(allowedRoles) { /* stub — moved to executive.v20260717-1.js */ }

/* REP/ADMIN FORMS: Uploads files and posts announcements. */
function connectRepForms() { /* stub — moved to executive.v20260717-1.js */ }

/* GENERIC BULK UPLOAD: Admin can select a prepared folder and upload by course/type. */
function connectGenericBulkUpload() { /* stub — moved to executive.v20260717-1.js */ }

/* SUGGESTION FORM: Lets checked-in students send structured notes to staff. */
function connectSuggestionForm() {
  const form = getElement("#suggestionForm");
  const status = getElement("#suggestionStatus");
  const anonToggle = getElement("#suggestionAnonymous");
  const anonLabel = getElement("#anonSendingAs");
  if (!form) return;

  /* ANONYMOUS TOGGLE: Update the 'Sending as' label when toggled. */
  function updateAnonLabel() {
    if (!anonLabel) return;
    const session = getMemberSession();
    if (!session?.name) { anonLabel.hidden = true; return; }
    const isAnon = anonToggle?.checked;
    anonLabel.textContent = isAnon
      ? "Sending anonymously — reps will not see your name."
      : `Sending as ${session.name} (${session.matricNumber})`;
    anonLabel.hidden = false;
  }

  anonToggle?.addEventListener("change", updateAnonLabel);
  updateAnonLabel();

  const categoryInput = form.querySelector('[name="category"]');
  form.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      form.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      if (categoryInput) categoryInput.value = btn.dataset.category;
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const session = getMemberSession();
    if (!session?.memberId) {
      status.textContent = "Complete the class check-in first, then send your suggestion.";
      return;
    }

    const formData = new FormData(form);
    const isAnonymous = Boolean(anonToggle?.checked);
    try {
      status.textContent = "Sending suggestion...";
      await state.backend.submitSuggestion({
        name: session.name,
        matricNumber: session.matricNumber,
        category: String(formData.get("category")),
        message: String(formData.get("message")).trim(),
        isAnonymous,
      });
      form.reset();
      if (anonToggle) anonToggle.checked = false;
      updateAnonLabel();
      status.textContent = isAnonymous
        ? "Suggestion sent anonymously. Thank you."
        : "Suggestion sent. Thank you.";
      showToast(isAnonymous ? "Suggestion sent anonymously." : "Suggestion sent to the reps and admin.");
    } catch (error) {
      status.textContent = error.message || "Could not send suggestion.";
    }
  });
}

/* EDIT MODALS: Lets staff correct titles, contexts, filenames, and announcements after posting. */
function closeEditModal() {
  getElement("#editPostModal")?.remove();
}

function openEditResourceModal(resource) { /* stub — moved to executive.v20260717-1.js */ }

function openEditAnnouncementModal(announcement) { /* stub — moved to executive.v20260717-1.js */ }

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
  context.fillText(`From: ${suggestion.isAnonymous ? "Anonymous" : stripSiteEmoji(suggestion.name)}`, 140, 720);
  context.fillText(`Matric: ${suggestion.isAnonymous ? "---" : stripSiteEmoji(suggestion.matricNumber)}`, 140, 758);
  context.fillText(`Sent: ${formatDate(suggestion.createdAtMs)}`, 760, 758);

  context.fillStyle = "rgba(23, 27, 31, 0.45)";
  context.font = "400 18px Inter, Arial, sans-serif";
  context.fillText("Generated from PhysioK29 staff portal", 140, 845);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `physiok29-suggestion-${suggestion.isAnonymous ? "anonymous" : stripSiteEmoji(suggestion.matricNumber || "student")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openSuggestionModal(suggestion) { /* stub — moved to executive.v20260717-1.js */ }

/* STAFF ACTIONS: Deletes resources, announcements, suggestions, and member records. */
function connectStaffActions() { /* stub — moved to executive.v20260717-1.js */ }

function connectStaffAnalytics() { /* stub — moved to executive.v20260717-1.js */ }

/* STAFF TABS: Turns staff portals into app-like workspaces instead of long scroll pages. */
function connectStaffTabs() { /* stub — moved to executive.v20260717-1.js */ }

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
  document.addEventListener("click", (event) => {
    const showAllButton = event.target.closest("[data-show-all-notifications]");
    if (showAllButton) {
      const list = getElement("#notificationCenterList");
      if (list) {
        const showingAll = list.dataset.showAll === "true";
        list.dataset.showAll = showingAll ? "false" : "true";
        showAllButton.textContent = showingAll ? `View all ${getNotificationItems().length} notifications` : "Show fewer";
      }
      return;
    }
  });

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

async function connectStudyGuide() {
  if (document.body.dataset.page !== "exam") return;

  document.addEventListener("change", async (event) => {
    const courseSelect = event.target.closest("#studyGuideCourseSelect");
    if (!courseSelect) return;
    state.selectedStudyGuideCourse = courseSelect.value;
    state.selectedStudyGuideTopic = studyGuideTopicsForCourse(courseSelect.value)[0]?.topic || "";
    state.studyGuideFlashcardIndex = 0;
    await renderExamMode();
  });

  document.addEventListener("click", async (event) => {
    const topicButton = event.target.closest("[data-study-topic]");
    const flashcard = event.target.closest("[data-flashcard]");
    const flashcardNav = event.target.closest("[data-flashcard-nav]");

    if (topicButton) {
      state.selectedStudyGuideTopic = topicButton.dataset.studyTopic;
      state.studyGuideFlashcardIndex = 0;
      await renderExamMode();
      getElement("#studyGuideSummary")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (flashcardNav) {
      const cards = await buildFlashcards(studyGuideTopic());
      if (!cards.length) return;
      const direction = flashcardNav.dataset.flashcardNav === "prev" ? -1 : 1;
      state.studyGuideFlashcardIndex = (state.studyGuideFlashcardIndex + direction + cards.length) % cards.length;
      await renderExamMode();
      return;
    }

    if (flashcard) {
      flashcard.toggleAttribute("data-revealed");
    }
  });
}

/* RESOURCE ENGAGEMENT: Lets students tag progress, vote helpful, and download course ZIPs. */
function connectResourceEngagement() {
  document.addEventListener("click", async (event) => {
    const progressButton = event.target.closest("[data-progress-resource]");
    const helpfulButton = event.target.closest("[data-helpful-resource]");
    const zipButton = event.target.closest("[data-download-course-zip]");
    const downloadButton = event.target.closest("[data-download-resource]");

    try {
      if (progressButton) {
        const resourceId = progressButton.dataset.progressResource;
        const status = progressButton.dataset.progressStatus;
        progressButton.disabled = true;
        const progress = await state.backend.saveResourceProgress({ resourceId, status });
        setResourceProgress(resourceId, progress);
        renderResourceCards();
        renderCourseGrid();
        await renderExamMode();
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
        await renderExamMode();
        showToast(feedback.helpful ? "Marked as helpful." : "Helpful vote removed.");
        return;
      }

      if (zipButton) {
        zipButton.disabled = true;
        await downloadCourseZip(zipButton.dataset.downloadCourseZip);
        zipButton.disabled = false;
      }

      if (downloadButton) {
        downloadButton.disabled = true;
        await downloadIndividualResource(downloadButton.dataset.downloadResource);
        downloadButton.disabled = false;
      }
    } catch (error) {
      if (progressButton) progressButton.disabled = false;
      if (helpfulButton) helpfulButton.disabled = false;
      if (zipButton) zipButton.disabled = false;
      if (downloadButton) downloadButton.disabled = false;
      showToast(error.message || "Action failed.", "error");
    }
  });
}

/* QUIZ MODE: Starts practice/exam sessions and submits answers securely through the portal function. */
function connectQuizMode() {
  const setupForm = getElement("#quizSetupForm");
  const courseSelect = getElement("#quizCourseSelect");
  const submitButton = getElement("#submitQuizAttempt");
  const answerForm = getElement("#quizAnswerForm");
  if (!setupForm && !submitButton) return;

  document.body.dataset.quizFocus = "setup";
  courseSelect?.addEventListener("change", populateQuizTopicSelect);

  answerForm?.addEventListener("change", (event) => {
    const input = event.target.closest?.('input[type="radio"][name^="question-"]');
    if (!input) return;
    const questionId = input.name.replace("question-", "");
    state.study.answers = { ...(state.study.answers || {}), [questionId]: input.value };
    renderQuizQuestions();
  });

  answerForm?.addEventListener("click", (event) => {
    const navButton = event.target.closest?.("[data-quiz-nav]");
    const exitButton = event.target.closest?.("[data-exit-quiz]");
    const reviewButton = event.target.closest?.("[data-review-submit]");

    if (exitButton) {
      const shouldExit = confirm("Exit this attempt? Your current answers will not be submitted.");
      if (!shouldExit) return;
      stopQuizTimer();
      state.study.questions = [];
      state.study.answers = {};
      state.study.currentIndex = 0;
      document.body.dataset.quizFocus = "setup";
      const playerPanel = getElement("#quizPlayerPanel");
      const resultPanel = getElement("#quizResultPanel");
      if (playerPanel) playerPanel.hidden = true;
      if (resultPanel) resultPanel.hidden = true;
      getElement("#quizSetupPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (reviewButton) {
      submitButton?.click();
      return;
    }

    if (!navButton) return;
    const direction = navButton.dataset.quizNav;
    const total = state.study.questions.length;
    const nextIndex =
      direction === "next" ? Number(state.study.currentIndex || 0) + 1 : Number(state.study.currentIndex || 0) - 1;
    state.study.currentIndex = Math.max(0, Math.min(nextIndex, Math.max(0, total - 1)));
    renderQuizQuestions();
  });

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
      state.study.answers = {};
      state.study.currentIndex = 0;
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
    const unanswered = state.study.questions.filter((question) => !state.study.answers?.[question.id]).length;
    if (unanswered && !confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) {
      return;
    }
    submitButton.disabled = true;
    const status = getElement("#quizStatus");
    const answers = state.study.questions.map((question) => ({
      questionId: question.id,
      selectedAnswer: state.study.answers?.[question.id] || "",
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
      const questionTopics = new Map((state.study.questions || []).map((q) => [String(q.id), q.topic]));
      const strongTopics = (data.results || [])
        .filter((r) => r.correct)
        .reduce((map, r) => {
          const topic = r.topic || questionTopics.get(String(r.questionId)) || "General";
          map.set(topic, (map.get(topic) || 0) + 1);
          return map;
        }, new Map());
      const summary = data.summary || getStudySummary();
      summary.strongTopics = [...strongTopics.entries()]
        .filter(([, count]) => count >= 2)
        .map(([topic]) => ({ topic, accuracy: 100 }));
      state.study.setup = { ...(state.study.setup || {}), summary };
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

/* LEGACY TIMETABLE PDF: Kept only so older cached buttons fail gracefully after exams. */
function createTimetablePdfBlob() {
  if (!cbtTimetable.length) {
    throw new Error("The exam timetable has been cleared now that exams are over.");
  }
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
      pdfText(margin, 548, "PhysioK29 Exam Timetable", 20, "F2"),
      "0.39 0.44 0.42 rg",
      pdfText(margin, 528, "Archived faculty exam rows matched to Physiology Class 2k29 courses.", 10),
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
      pdfText(margin, 44, "Archived exam timetable.", 9),
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

/* MEMBERS PDF DOWNLOAD: Exports the class members table as a PDF. */
function connectMembersPdfDownload() { /* stub — moved to executive.v20260717-1.js */ }

/* ANALYTICS PDF: Exports study analytics (leaderboard + streaks + quiz/exam usage) as a PDF. */
function createAnalyticsPdfBlob() {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 34;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 22;
  const rowsPerPage = 18;

  const summaries = state.members
    .map((member) => ({ member, summary: summarizeMemberStudy(member.id) }))
    .sort((a, b) => b.summary.durationSeconds - a.summary.durationSeconds || b.summary.percent - a.summary.percent);

  const totalQuestions = state.quizAttempts.reduce((sum, a) => sum + Number(a.questionCount || 0), 0);
  const totalScore = state.quizAttempts.reduce((sum, a) => sum + Number(a.score || 0), 0);
  const totalDuration = state.quizAttempts.reduce((sum, a) => sum + Number(a.durationSeconds || 0), 0);
  const quizOnly = state.quizAttempts.filter((a) => a.mode === "practice").length;
  const examOnly = state.quizAttempts.filter((a) => a.mode === "exam").length;
  const activeWeek = new Set(
    state.studyEvents.filter((e) => Date.now() - e.createdAtMs < 7 * 24 * 60 * 60 * 1000).map((e) => e.memberId)
  ).size;
  const topStreak = state.members.reduce((best, m) => Math.max(best, getMemberStreak(m.id)), 0);
  const topStreakMember = state.members.find((m) => getMemberStreak(m.id) === topStreak);

  const columns = [
    { label: "No.", width: 34, value: (_, i) => String(i + 1), max: 4 },
    { label: "Name", width: 180, value: (s) => s.member.name, max: 28 },
    { label: "Matric", width: 90, value: (s) => s.member.matricNumber, max: 14 },
    { label: "Quiz", width: 44, value: (s) => String(s.summary.quizCount), max: 5 },
    { label: "Exam", width: 44, value: (s) => String(s.summary.examCount), max: 5 },
    { label: "Score", width: 56, value: (s) => `${s.summary.percent || 0}%`, max: 8 },
    { label: "Time", width: 68, value: (s) => formatDuration(s.summary.durationSeconds), max: 10 },
    { label: "Streak", width: 56, value: (s) => `${s.summary.streak}d`, max: 6 },
    { label: "Last attempt", width: tableWidth - 572, value: (s) => s.summary.lastAttemptAtMs ? formatDate(s.summary.lastAttemptAtMs) : "None", max: 20 },
  ];

  const pages = [];

  /* Page 1: Summary header + leaderboard */
  for (let start = 0; start < summaries.length || (start === 0 && summaries.length === 0); start += rowsPerPage) {
    const pageRows = summaries.slice(start, start + rowsPerPage);
    const pageNumber = pages.length + 1;
    const totalPages = Math.ceil(Math.max(summaries.length, 1) / rowsPerPage) || 1;
    const tableTop = 468;
    const headerBottom = tableTop - 26;
    const operations = [
      "1 1 1 rg 0 0 842 595 re f",
      "0.09 0.11 0.12 rg",
      pdfText(margin, 548, "PhysioK29 Study Analytics", 20, "F2"),
      "0.39 0.44 0.42 rg",
      pdfText(margin, 528, `Quiz attempts: ${quizOnly}  |  Exam attempts: ${examOnly}  |  Class avg: ${formatScorePercent(totalScore, totalQuestions)}  |  Active this week: ${activeWeek}  |  Top streak: ${topStreak}d${topStreakMember ? ` (${topStreakMember.name})` : ""}`, 9),
      pdfText(margin, 512, `Page ${pageNumber} of ${totalPages}  |  Generated from staff portal`, 9),
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

    pageRows.forEach((item, rowIndex) => {
      const rowTop = headerBottom - rowIndex * rowHeight;
      const rowBottom = rowTop - rowHeight;
      operations.push("0.82 0.80 0.74 RG", pdfLine(margin, rowBottom, margin + tableWidth, rowBottom));
      cursorX = margin;
      columns.forEach((column) => {
        const cell = fitPdfText(column.value(item, start + rowIndex), column.max);
        operations.push("0.09 0.11 0.12 rg", pdfText(cursorX + 7, rowBottom + 8, cell, 8.5));
        cursorX += column.width;
      });
    });

    if (!pageRows.length) {
      operations.push("0.39 0.44 0.42 rg", pdfText(margin + 7, headerBottom - 18, "No quiz or exam activity recorded yet.", 10));
    }

    operations.push(
      "0.39 0.44 0.42 rg",
      pdfText(margin, 44, "Private analytics. Keep within Physiology 2k29 staff use.", 9),
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
      body: `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
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

function connectAnalyticsPdfDownload() { /* stub — moved to executive.v20260717-1.js */ }

/* REALTIME DATA: Subscribes to live resource/announcement updates. */
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

/* REALTIME DATA: Subscribes to live resource/announcement updates for non-staff pages. */
function startPublicRealtimeData() {
  if (document.body.dataset.portal === "staff" || state.realtimeUnsubscribe) return;
  state.realtimeUnsubscribe = connectRealtimeData();
}

/* TIMETABLE DOWNLOAD: No visible button remains after exams; this guards older cached markup. */
/* SEMESTER SCHEDULE PDF: Student-handbook-style timetable for A4 printing. */
function createSemesterSchedulePdfBlob() {
  if (!MOCK_SCHEDULE.length) throw new Error("No schedule data available.");

  const pw = 595, ph = 842, m = 48;
  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const items = MOCK_SCHEDULE.filter((i) => daysOrder.includes(i.day) && i.week === 1)
    .sort((a, b) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day) || a.start_time.localeCompare(b.start_time));

  const pageContent = () => {
    const ops = [];
    // White page
    ops.push("1 1 1 rg 0 0 595 842 re f");

    // ── Header ──
    // University logo placeholder
    ops.push("0.09 0.11 0.12 rg");
    ops.push(pdfText(m, ph - m - 8, "UNIVERSITY OF IBADAN", 9));
    ops.push(pdfText(m, ph - m - 20, "Physiology Class 2K29", 9));
    // PhysioK29 on right
    ops.push(pdfText(pw - m - 100, ph - m - 8, "PHYSIOK29", 11, "F2"));
    ops.push(pdfText(pw - m - 100, ph - m - 20, "physiok29.vercel.app", 7));

    // Green divider
    const divY = ph - m - 32;
    ops.push("0.16 0.62 0.50 RG 2 w");
    ops.push(`${m} ${divY} ${pw - m * 2} ${divY} re S`);
    ops.push("0.5 w 0.82 0.80 0.74 RG");
    ops.push(`${m} ${divY - 2} ${pw - m * 2} ${divY - 2} re S`);

    // ── Title ──
    const titleY = divY - 48;
    ops.push("0.09 0.11 0.12 rg");
    ops.push(pdfText(m, titleY, "Second Semester", 18, "F2"));
    ops.push(pdfText(m, titleY - 24, "Teaching Timetable", 22, "F2"));
    ops.push("0.39 0.44 0.42 rg");
    ops.push(pdfText(m, titleY - 44, "2025/2026 Academic Session", 10));

    // ── Table ──
    const colDefs = [
      { label: "Day", w: 68 },
      { label: "Time", w: 88 },
      { label: "Course Code", w: 90 },
      { label: "Course Title", w: 165 },
      { label: "Venue", w: 100 },
    ];
    const totalW = colDefs.reduce((s, c) => s + c.w, 0);
    let xOff = m + (pw - m * 2 - totalW) / 2; // center table

    const thY = titleY - 82;
    const thH = 26;
    const rowH = 24;

    // Table header bg
    ops.push("0.94 0.97 0.95 rg");
    ops.push(`${xOff} ${thY - thH} ${totalW} ${thH} re f`);
    ops.push("0.16 0.62 0.50 RG 0.5 w");
    ops.push(`${xOff} ${thY - thH} ${totalW} ${thH} re S`);

    let cx = xOff;
    colDefs.forEach((col) => {
      ops.push("0.09 0.11 0.12 rg");
      ops.push(pdfText(cx + 8, thY - 10, col.label, 8, "F2"));
      cx += col.w;
    });

    // Table rows
    items.forEach((item, ri) => {
      const ry = thY - thH - (ri + 1) * rowH;
      // day separator
      if (ri === 0 || items[ri - 1].day !== item.day) {
        ops.push("0.82 0.80 0.74 RG 0.3 w");
        ops.push(`${xOff} ${ry} ${xOff + totalW} ${ry} re S`);
      }

      const rowVals = [item.day, `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`, item.course_code, `  ${item.course_title}`, item.venue];
      cx = xOff;
      ops.push("0.09 0.11 0.12 rg");
      rowVals.forEach((val, ci) => {
        ops.push(pdfText(cx + 8, ry + 8, fitPdfText(val, 32), 8));
        cx += colDefs[ci].w;
      });

      // row line
      ops.push("0.82 0.80 0.74 RG 0.2 w");
      ops.push(`${xOff} ${ry} ${xOff + totalW} ${ry} re S`);
    });

    // ── Footer ──
    const footerY = 48;
    ops.push("0.39 0.44 0.42 rg");
    ops.push(pdfText(m, footerY, "Generated by PhysioK29", 8));
    ops.push(pdfText(m, footerY - 12, "https://physiok29.vercel.app", 7));

    // QR placeholder
    ops.push("0.94 0.97 0.95 rg");
    ops.push(`${pw - m - 54} ${footerY - 4} 48 48 re f`);
    ops.push("0.82 0.80 0.74 RG 0.3 w");
    ops.push(`${pw - m - 54} ${footerY - 4} 48 48 re S`);
    ops.push("0.39 0.44 0.42 rg");
    ops.push(pdfText(pw - m - 46, footerY + 20, "Scan", 6));

    // Bottom line
    ops.push("0.82 0.80 0.74 RG 0.3 w");
    ops.push(`${m} ${footerY + 30} ${pw - m * 2} ${footerY + 30} re S`);

    return ops.join("\n");
  };

  const content = pageContent();
  const regularFontId = 3, boldFontId = 4;
  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: "<< /Type /Pages /Kids [5 0 R] /Count 1 >>" },
    { id: regularFontId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    { id: boldFontId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" },
    { id: 5, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents 6 0 R >>` },
    { id: 6, body: `<< /Length ${content.length} >>\nstream\n${content}\nendstream` },
  ];

  const offsets = new Array(7).fill(0);
  let pdf = "%PDF-1.4\n";
  objects.forEach((obj) => {
    offsets[obj.id] = pdf.length;
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

/* TIMETABLE RENDERING: Card-based weekly schedule for the timetable page. */
function renderWeeklySchedule() {
  const container = getElement("#weeklySchedule");
  if (!container) return;

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const scheduleByDay = {};
  MOCK_SCHEDULE.filter((i) => i.week === 1).forEach((item) => {
    if (!scheduleByDay[item.day]) scheduleByDay[item.day] = [];
    scheduleByDay[item.day].push(item);
  });

  container.innerHTML = days.map((day) => {
    const items = (scheduleByDay[day] || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (!items.length) return "";
    return `<div class="tt-day-group">
      <div class="tt-day-header">
        <span class="tt-day-label">${day}</span>
        <span class="tt-day-count">${items.length} lecture${items.length > 1 ? "s" : ""}</span>
      </div>
      <div class="tt-day-cards">
        ${items.map((item) => `<a class="tt-card" href="./courses.html?course=${encodeURIComponent(item.course_code)}">
          <div class="tt-time">
            <strong>${item.start_time.slice(0, 5)}</strong>
            <small>${item.end_time.slice(0, 5)}</small>
          </div>
          <div class="tt-body">
            <span class="tt-code">${item.course_code}</span>
            <span class="tt-title">${item.course_title}</span>
            <span class="tt-venue"><span class="material-symbols-rounded" aria-hidden="true">location_on</span>${item.venue}</span>
          </div>
          <span class="material-symbols-rounded tt-card-arrow" aria-hidden="true">chevron_right</span>
        </a>`).join("")}
      </div>
    </div>`;
  }).join("");
}

function connectTimetable() {
  if (document.body.dataset.page !== "timetable") return;
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = dayNames[new Date().getDay()];
  document.querySelectorAll(".timetable-table").forEach((table) => {
    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, i) => {
      if (th.textContent.trim().toLowerCase() === today) {
        table.querySelectorAll(`tbody tr`).forEach((row) => {
          const cell = row.children[i];
          if (cell && cell.textContent.trim() !== "—") {
            cell.classList.add("today-cell");
          }
        });
      }
    });
  });
}

function connectTimetableDownload() {
  const pngButton = getElement("#downloadTimetablePng");
  if (!pngButton) return;

  const TIMETABLE_IMAGE_URL = "https://rfrlddiebyfojnzbfldy.supabase.co/storage/v1/object/public/class-resources/timetable/PhysioK29-Timetable.png";

  pngButton.addEventListener("click", async () => {
    try {
      pngButton.disabled = true;
      const res = await fetch(TIMETABLE_IMAGE_URL);
      if (!res.ok) throw new Error("Could not fetch image");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "PhysioK29-Timetable.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast("Timetable downloaded.");
    } catch (err) {
      window.open(TIMETABLE_IMAGE_URL, "_blank");
      showToast("Opened image in new tab.");
    } finally {
      pngButton.disabled = false;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN ENHANCED: Metric cards, charts, resource filters, member search
   ═══════════════════════════════════════════════════════════════════ */

function setMetricText(selector, value) { /* stub — moved to executive.v20260717-1.js */ }

/* Weekly activity bar chart: last 7 days of active unique students */
function renderWeeklyActivityChart() { /* stub — moved to executive.v20260717-1.js */ }

/* Engagement ring: active students / total members */
function renderEngagementRing() { /* stub — moved to executive.v20260717-1.js */ }

/* Rep summary: populate the three metric cards */
function renderRepSummary() { /* stub — moved to executive.v20260717-1.js */ }

/* Resource filters: search, filter by type, sort */
function connectResourceFilters() { /* stub — moved to executive.v20260717-1.js */ }

/* Member search: filter members table by name or matric */
function connectMemberSearch() {
  const input = getElement("#memberSearchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const body = getElement("#membersTableBody");
    if (!body) return;

    const filtered = state.members.filter((m) =>
      `${m.name || ""} ${m.matricNumber || ""}`.toLowerCase().includes(query)
    );

    const canDeleteMembers = isAdminPortal();
    const canViewHistory = Boolean(getElement("#memberStudyHistoryPanel"));
    const hasActionColumn = canDeleteMembers || canViewHistory;

    body.innerHTML = filtered.length
      ? filtered
          .map(
            (member) => `
              <tr>
                <td>${escapeHtml(member.name)}</td>
                <td>${escapeHtml(member.matricNumber)}</td>
                <td>
                  <span class="member-status-badge ${getMemberStreak(member.id) > 0 ? "active" : "inactive"}">
                    <span class="status-dot"></span>
                    ${getMemberStreak(member.id) > 0 ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <span class="member-push-badge ${member.notificationEnabled ? "on" : "off"}">
                    ${member.notificationEnabled ? "On" : "Off"}
                  </span>
                </td>
                <td>
                  <span class="member-streak-display">
                    ${getMemberStreak(member.id) > 0 ? '<span class="streak-fire">🔥</span>' : ""}
                    ${getMemberStreak(member.id)}d
                  </span>
                </td>
                <td>${formatDate(member.lastSeenAtMs || member.createdAtMs)}</td>
                ${
                  hasActionColumn
                    ? `<td>
                        <div class="table-actions">
                          ${canViewHistory ? `<button class="ghost-link" data-view-member-history="${member.id}">History</button>` : ""}
                          ${canDeleteMembers ? `<button class="danger-link" data-delete-member="${member.id}">Delete</button>` : ""}
                        </div>
                      </td>`
                    : ""
                }
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="${hasActionColumn ? 7 : 6}">No members match your search.</td></tr>`;
  });
}

/* CSV export for members */
function connectMembersCsvExport() { /* stub — moved to executive.v20260717-1.js */ }

function setText(selector, text) {
  const el = getElement(selector);
  if (el) el.textContent = text;
}

/* ── BIRTHDAY ONBOARDING ───────────────────────────────────── */

const BIRTHDAY_PROFILE_KEY = "physiology2k29.birthdayCompleted";
const BIRTHDAY_SNOOZE_KEY = "physiology2k29.birthdaySnoozedUntil";

function isBirthdayCompletedLocally() {
  return localStorage.getItem(BIRTHDAY_PROFILE_KEY) === "true";
}

function markBirthdayCompletedLocally() {
  try { localStorage.setItem(BIRTHDAY_PROFILE_KEY, "true"); } catch {}
  try { localStorage.removeItem(BIRTHDAY_SNOOZE_KEY); } catch {}
}

function snoozeBirthdayReminder() {
  try { localStorage.setItem(BIRTHDAY_SNOOZE_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000)); } catch {}
}

async function ensureBirthdayOnboarding() {
  if (document.body.dataset.portal === "staff") return;
  if (!getMemberSession()?.memberId) return;
  if (isBirthdayCompletedLocally()) return;

  const snoozedUntil = Number(localStorage.getItem(BIRTHDAY_SNOOZE_KEY) || 0);
  if (snoozedUntil > Date.now()) return;

  const existingOverlay = getElement("#birthdayOnboarding");
  if (existingOverlay) return;

  let profile = null;
  try {
    profile = await state.backend.getBirthdayProfile();
  } catch {
    return;
  }

  if (profile?.birthdayRegistrationCompleted) {
    markBirthdayCompletedLocally();
    return;
  }

  renderBirthdayOnboarding(profile);
}

function renderBirthdayOnboarding(profile) {
  if (getElement("#birthdayOnboarding")) return;

  const session = getMemberSession();
  const savedName = profile?.fullName || session?.name || "";

  const overlay = document.createElement("section");
  overlay.id = "birthdayOnboarding";
  overlay.className = "member-modal";
  overlay.innerHTML = `
    <form class="member-card" id="birthdayOnboardingForm">
      <p class="eyebrow">One-time setup</p>
      <h2>Celebrate with us! 🎉</h2>
      <p class="form-help">Your name, birth date, and photo let the class designer prepare birthday flyers for you.</p>

      <label>
        Full name
        <input name="fullName" type="text" value="${escapeHtml(savedName)}" placeholder="e.g. Suberu Igbobamiji Barawo" required />
      </label>

      <label>
        Date of birth
        <input name="dateOfBirth" type="date" min="2000-01-01" max="2010-12-31" required />
      </label>

      <label class="birthday-photo-label">
        <span>Your photo <small>(required)</small></span>
        <button type="button" class="birthday-photo-preview" id="birthdayPhotoPreview">
          <span class="material-symbols-rounded" aria-hidden="true">add_a_photo</span>
          <span>Tap to choose a photo</span>
        </button>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required hidden />
        <small class="form-help">Portrait, half-body, or full-body photo. Max 10 MB.</small>
      </label>

      <div class="birthday-actions">
        <button class="secondary-action" type="button" data-remind-later>Remind Me Later</button>
        <button class="primary-action" type="submit">Complete Now</button>
      </div>
      <p class="form-status" id="birthdayOnboardingStatus"></p>
    </form>
  `;

  document.body.appendChild(overlay);

  const form = getElement("#birthdayOnboardingForm");
  const status = getElement("#birthdayOnboardingStatus");
  const photoInput = form.querySelector('input[name="photo"]');
  const photoPreview = getElement("#birthdayPhotoPreview");

  form.querySelector("[data-remind-later]").addEventListener("click", () => {
    snoozeBirthdayReminder();
    overlay.remove();
    showToast("We'll remind you again in a few days.");
  });

  photoPreview.addEventListener("click", () => photoInput?.click());

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      photoPreview.innerHTML = `
        <span class="material-symbols-rounded" aria-hidden="true">add_a_photo</span>
        <span>Tap to choose a photo</span>
      `;
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      photoPreview.innerHTML = `
        <span class="material-symbols-rounded" aria-hidden="true">warning</span>
        <span>Photo too large. Max 10 MB.</span>
      `;
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") || "").trim();
    const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
    const photoFile = formData.get("photo");

    if (!fullName || fullName.length < 2) {
      status.textContent = "Enter your full name.";
      return;
    }
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      status.textContent = "Select your date of birth.";
      return;
    }
    if (!(photoFile instanceof File) || photoFile.size === 0) {
      status.textContent = "Please select a photo to upload.";
      return;
    }

    status.textContent = "Saving your profile...";
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const remindBtn = form.querySelector("[data-remind-later]");
    if (remindBtn) remindBtn.disabled = true;

    try {
      status.textContent = "Uploading photo...";
      const memberId = getMemberSession()?.memberId || "unknown";
      const photoUrl = await state.backend.uploadBirthdayPhoto(photoFile, memberId);

      status.textContent = "Saving birthday profile...";
      await state.backend.saveBirthdayProfile(fullName, dateOfBirth, photoUrl);

      markBirthdayCompletedLocally();
      overlay.remove();
      renderBirthdayPhotoSettings();
      showToast("Happy birthday in advance, " + fullName.split(" ")[0] + "!");
    } catch (error) {
      status.textContent = error.message || "Could not save profile. Try again.";
      submitBtn.disabled = false;
      if (remindBtn) remindBtn.disabled = false;
    }
  });
}

/* ── BIRTHDAY PHOTO SETTINGS ───────────────────────────────── */

function renderBirthdayPhotoSettings() {
  const existingBtn = getElement("#birthdayPhotoSettings");
  if (existingBtn) existingBtn.remove();
  if (document.body.dataset.portal === "staff" || !isDashboardPage()) return;
  if (!getMemberSession()?.memberId) return;
  if (!isBirthdayCompletedLocally()) return;

  const panel = getElement(".notification-setup");
  if (!panel) return;

  const btn = document.createElement("div");
  btn.id = "birthdayPhotoSettings";
  btn.className = "notification-setup";
  btn.style.marginTop = "8px";
  btn.innerHTML = `
    <div>
      <span class="material-symbols-rounded" aria-hidden="true">photo_camera</span>
      <div>
        <strong>Birthday photo</strong>
        <p>Update your photo for the class birthday flyer.</p>
      </div>
    </div>
    <button class="secondary-action" type="button" data-replace-birthday-photo>
      <span class="material-symbols-rounded" aria-hidden="true">edit</span>
      Replace photo
    </button>
  `;
  panel.insertAdjacentElement("afterend", btn);

  btn.querySelector("[data-replace-birthday-photo]").addEventListener("click", async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.click();

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showToast("Photo too large. Max 10 MB.", "error");
        return;
      }

      try {
        const memberId = getMemberSession()?.memberId || "unknown";
        const photoUrl = await state.backend.uploadBirthdayPhoto(file, memberId);

        const profile = await state.backend.getBirthdayProfile();
        if (profile) {
          await state.backend.saveBirthdayProfile(profile.fullName, profile.dateOfBirth, photoUrl);
        }
        showToast("Birthday photo updated.");
      } catch (error) {
        showToast(error.message || "Could not update photo.", "error");
      }
    });
  });
}

/* ── DESIGNER BIRTHDAY DASHBOARD ───────────────────────────── */

async function loadBirthdayList() { /* stub — moved to executive.v20260717-1.js */ }

function getUpcomingBirthdays(memberList) { /* stub — moved to executive.v20260717-1.js */ }

function renderBirthdayDashboard() { /* stub — moved to executive.v20260717-1.js */ }

async function triggerBirthdayNotification() { /* stub — moved to executive.v20260717-1.js */ }

function renderBirthdayManager(upcoming, allMembers) { /* stub — moved to executive.v20260717-1.js */ }

/* ── END BIRTHDAY FUNCTIONS ────────────────────────────────── */

async function init() {
  console.log("[PhysioK29] app version:", APP_VERSION);
  renderBootLoader("Opening portal");
  registerPortalServiceWorker();
  updateBootLoader("Connecting to class portal");
  state.backend = await createBackend();
  updateBootLoader("Checking your session");
  setMemberGate(!getMemberSession()?.memberId);
  populateCourseSelects();
  await loadStudyGuideData();
  renderAll();
  updateBootLoader("Preparing page tools");
  connectConnectionStatus();
  connectSearch();
  renderBreakLockNav();
  enforceBreakLock();
  connectSuggestionForm();
  connectCopyButtons();
  connectSiteGuide();
  connectStreakSummary();
  connectInstallPrompt();
  connectNotificationSetup();
  connectStudyGuide();
  connectResourceEngagement();
  connectQuizMode();
  connectTimetable();
  connectTimetableDownload();
  connectMemberSearch();
  window.setInterval(() => {
    renderExamMode();
    renderNextLecture();
  }, 1000);
  updateBootLoader("Verifying class access");
  const memberReady = await ensureMemberOnboarding();
  if (memberReady) {
    updateBootLoader("Syncing study tools");
    await loadQuizSetup();
    startPublicRealtimeData();
    updateBootLoader("Checking profile setup");
    await ensureBirthdayOnboarding();
    renderBirthdayPhotoSettings();
  }
  hideBootLoader();
}

init().catch((error) => {
  console.error(error);
  showBootLoaderError(error.message || "The portal could not start.");
  showToast(error.message || "The portal could not start.", "error");
});
