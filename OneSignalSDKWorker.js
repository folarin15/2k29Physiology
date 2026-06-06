/* OneSignal web push worker: must stay at the site root for browser push scope. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

/* OFFLINE SHELL: Keeps the student-facing portal usable when the network drops. */
const PORTAL_CACHE = "physiok29-shell-20260606b";
const OFFLINE_URL = "/offline.html";
const STAFF_PATHS = ["/K29.admin", "/K29.rep", "/admin.html", "/rep.html"];
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/courses.html",
  "/timetable.html",
  "/quiz.html",
  "/exam-room.html",
  "/exam.html",
  "/reader.html",
  "/reps.html",
  "/suggestions.html",
  OFFLINE_URL,
  "/styles.css",
  "/app.js",
  "/reader.js",
  "/data.js",
  "/supabase-config.js",
  "/supabase-service.js",
  "/site.webmanifest",
  "/assets/ui-logo.jpeg",
  "/assets/favicon.png",
  "/assets/og-image.png",
];

function isStaffRequest(url) {
  return STAFF_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

function isSameOriginPublicRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && !isStaffRequest(url);
}

function isCacheableAsset(request) {
  const url = new URL(request.url);
  return (
    isSameOriginPublicRequest(request) &&
    ["script", "style", "image", "font", "manifest"].includes(request.destination)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PORTAL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("physiok29-shell-") && key !== PORTAL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isSameOriginPublicRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) {
            caches.open(PORTAL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          return cachedPage || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (isCacheableAsset(request)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
        const freshResponse = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(PORTAL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cachedResponse);

        return cachedResponse || freshResponse;
      })
    );
  }
});
