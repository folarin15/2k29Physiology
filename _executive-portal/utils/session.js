// ============================================================
// PhysioK29 — Session Management Utilities
// ============================================================

import { MEMBER_SESSION_KEY, MEMBER_SESSION_COOKIE } from "../constants/SHARED_CONSTANTS.js";

export function getMemberSession() {
  try {
    const storedSession = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY));
    if (storedSession?.memberId) return storedSession;
  } catch {}

  try {
    const cookieSession = JSON.parse(decodeURIComponent(getCookieValue(MEMBER_SESSION_COOKIE) || "null"));
    if (cookieSession?.memberId) {
      localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    }
  } catch {}

  return null;
}

export function saveMemberSession(session) {
  try {
    localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
  } catch {}
  saveMemberSessionCookie(session);
}

export function clearMemberSession() {
  try {
    localStorage.removeItem(MEMBER_SESSION_KEY);
  } catch {}
  clearMemberSessionCookie();
}

function saveMemberSessionCookie(session) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${MEMBER_SESSION_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
}

function clearMemberSessionCookie() {
  document.cookie = `${MEMBER_SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getCookieValue(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function isStaffPortal() {
  return globalThis.document?.body?.dataset.portal === "staff";
}

export function isAdminPortal() {
  return globalThis.document?.body?.dataset.portalRole === "admin";
}

export function isPublicMemberPage() {
  return globalThis.document?.body?.dataset.portal !== "staff";
}

export function getStoredMemberSession() {
  return getMemberSession();
}
