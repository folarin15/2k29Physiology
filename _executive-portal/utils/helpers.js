// ============================================================
// PhysioK29 — Shared Utility Functions
// ============================================================

export function toMillis(value) {
  if (!value) return 0;
  return new Date(value).getTime() || 0;
}

export function escapeHtml(value) {
  if (value == null) return "";
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

export function getElement(selector) {
  return document.querySelector(selector);
}

export function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sortByCreatedAt(items) {
  return [...items].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function stripSiteEmoji(value = "") {
  return String(value)
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanStoredText(value = "") {
  return stripSiteEmoji(value);
}

export function safeFileName(fileName) {
  return String(fileName || "resource")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function normalizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 3) throw new Error("Enter your full name.");
  if (name.length > 80) throw new Error("Name is too long.");
  return name;
}

export function normalizeMatric(value) {
  const matricNumber = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (matricNumber.length < 3) throw new Error("Enter a valid matric number.");
  if (matricNumber.length > 24) throw new Error("Matric number is too long.");
  return matricNumber;
}

export function normalizeSuggestionMessage(value) {
  const message = String(value || "").trim();
  if (message.length < 3) throw new Error("Write a little more before sending.");
  if (message.length > 1200) throw new Error("Suggestion is too long.");
  return message;
}

export function isDashboardPage() {
  const path = window.location.pathname;
  return path === "/dashboard.html" || path === "/" || path.endsWith("/dashboard");
}

export function showToast(message, tone = "default") {
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

export function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatCountdownParts(targetDate) {
  const now = Date.now();
  const diff = targetDate.getTime() - now;
  if (diff <= 0) return [{ label: "Resumed", value: "🎉" }];
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return [{ label: "Days", value: days }, { label: "Hours", value: hours }];
}
