// ============================================================
// PhysioK29 — Shared Constants for Student & Executive Portals
// ============================================================

export const APP_VERSION = "20260717-1";

export const SUPABASE_PROJECT_REF = "rfrlddiebyfojnzbfldy";
export const SUPABASE_URL = "https://rfrlddiebyfojnzbfldy.supabase.co";

export const STORAGE_BUCKETS = {
  CLASS_RESOURCES: "class-resources",
  BIRTHDAY_PHOTOS: "birthday-photos",
};

export const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
export const MEMBER_SESSION_COOKIE = "physiok29_member_session";

export const NOTIFICATION_CONSTANTS = {
  ONESIGNAL_PROMPT_KEY: "physiology2k29.onesignalPromptAsked",
  NOTIFICATION_READ_KEY: "physiology2k29.readNotifications",
  NOTIFICATION_COLLAPSED_KEY: "physiology2k29.notificationCenterCollapsed",
};

export const INSTALL_CONSTANTS = {
  DISMISSED_KEY: "physiology2k29.installPromptDismissed",
  ACCEPTED_KEY: "physiology2k29.installPromptAccepted",
  DISMISS_SNOOZE_MS: 7 * 24 * 60 * 60 * 1000,
};

export const BIRTHDAY_PROFILE_KEY = "physiology2k29.birthdayCompleted";

export const ACADEMIC_CONSTANTS = {
  CURRENT_SESSION: "2025/2026",
  CURRENT_SEMESTER: "Second",
  RESUMPTION_DATE: new Date("2026-08-25T00:00:00"),
};

export const ROUTES = {
  STUDENT: {
    DASHBOARD: "/dashboard.html",
    COURSES: "/courses.html",
    TIMETABLE: "/timetable.html",
    QUIZ: "/quiz.html",
    EXAM_ROOM: "/exam-room.html",
    EXAM: "/exam.html",
    SUGGESTIONS: "/suggestions.html",
    REPS: "/reps.html",
    READER: "/reader.html",
    SEED: "/seed.html",
  },
  EXECUTIVE: {
    ADMIN: "/K29.admin/index.html",
    REP: "/K29.rep/index.html",
  },
};

export const STAFF_ROLES = {
  ADMIN: "admin",
  REP: "rep",
};

export const PORTAL_TYPES = {
  STUDENT: undefined,
  STAFF: "staff",
};

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".ppt", ".pptx", ".doc", ".docx", ".png", ".jpg", ".jpeg",
]);

export const MAX_UPLOAD_SIZES = {
  RESOURCE: 50 * 1024 * 1024,
  BIRTHDAY_PHOTO: 10 * 1024 * 1024,
};

export const RESOURCE_PAGE_SIZE = 1000;
export const QUIZ_BANK_URL = "./quiz-bank.json";
export const QUIZ_BANK_CACHE_KEY = "physiology2k29.quizBank";
