import { createBackend } from "./supabase-service.js?v=20260527d";

const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const MEMBER_SESSION_COOKIE = "physiok29_member_session";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const state = {
  backend: null,
  resource: null,
  progress: null,
  pdf: null,
  page: 1,
  totalPages: 0,
  zoom: 1.12,
  saveTimer: null,
  rendering: false,
};

function getElement(selector) {
  return document.querySelector(selector);
}

function getCookieValue(name) {
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getMemberSession() {
  try {
    const storedSession = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY));
    if (storedSession?.memberId) return storedSession;
  } catch {
    // Fall through to the cookie backup.
  }

  try {
    const cookieSession = JSON.parse(decodeURIComponent(getCookieValue(MEMBER_SESSION_COOKIE) || "null"));
    if (cookieSession?.memberId) {
      localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    }
  } catch {
    // A bad cookie simply means the student should check in again.
  }

  return null;
}

function setStatus(text, tone = "muted") {
  const status = getElement("#readerStatus");
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

function setText(selector, text) {
  const element = getElement(selector);
  if (element) element.textContent = text;
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resourceKind(resource) {
  const haystack = `${resource?.fileType || ""} ${resource?.fileName || ""}`.toLowerCase();
  if (haystack.includes("pdf") || haystack.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/i.test(resource?.fileName || "") || haystack.startsWith("image/")) return "image";
  return "file";
}

function progressLabel(status = "opened") {
  return (
    {
      opened: "Opened",
      reading: "Reading",
      urgent: "Urgent",
      done: "Done",
    }[status] || "Opened"
  );
}

function progressTone(status = "opened") {
  return status === "done" ? "success" : "muted";
}

function updateReaderChrome() {
  const pageInfo = getElement("#readerPageInfo");
  const progressBar = getElement("#readerProgressBar");
  const previous = getElement("#readerPrev");
  const next = getElement("#readerNext");
  const original = getElement("#readerOriginal");
  const percent = state.totalPages ? Math.round((state.page / state.totalPages) * 100) : 0;

  if (pageInfo) pageInfo.textContent = state.totalPages ? `Page ${state.page} of ${state.totalPages}` : "Preview";
  if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (previous) previous.disabled = !state.pdf || state.page <= 1;
  if (next) next.disabled = !state.pdf || state.page >= state.totalPages;
  if (original && state.resource?.downloadUrl) original.href = state.resource.downloadUrl;
}

async function saveProgress(status = "reading", options = {}) {
  if (!state.resource?.id || !state.backend?.saveResourceProgress) return null;

  const progress = await state.backend.saveResourceProgress({
    resourceId: state.resource.id,
    status,
    currentPage: state.totalPages ? state.page : null,
    totalPages: state.totalPages || null,
    openedIncrement: Boolean(options.openedIncrement),
  });

  if (progress) state.progress = progress;
  return progress;
}

function scheduleProgressSave(status = "reading") {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    saveProgress(status).catch((error) => console.warn("Reader progress skipped:", error));
  }, 550);
}

async function renderPdfPage() {
  if (!state.pdf || state.rendering) return;
  state.rendering = true;

  try {
    const page = await state.pdf.getPage(state.page);
    const surface = getElement("#readerSurface");
    let canvas = getElement("#readerCanvas");

    if (!canvas) {
      surface.innerHTML = `<canvas id="readerCanvas" class="reader-canvas"></canvas>`;
      canvas = getElement("#readerCanvas");
    }

    const viewport = page.getViewport({ scale: state.zoom });
    const outputScale = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d");

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    await page.render({ canvasContext: context, viewport }).promise;
    setStatus(progressLabel(state.progress?.status || "reading"), progressTone(state.progress?.status || "reading"));
    updateReaderChrome();
    scheduleProgressSave("reading");
  } finally {
    state.rendering = false;
  }
}

async function renderPdf(resource) {
  const surface = getElement("#readerSurface");
  surface.innerHTML = `<p class="empty-message">Rendering PDF...</p>`;

  try {
    const pdfjs = await import(PDFJS_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    state.pdf = await pdfjs.getDocument({ url: resource.downloadUrl }).promise;
    state.totalPages = state.pdf.numPages;
    state.page = Math.min(Math.max(Number(state.progress?.currentPage || 1), 1), state.totalPages);
    updateReaderChrome();
    await saveProgress("opened", { openedIncrement: true });
    await renderPdfPage();
  } catch (error) {
    console.warn(error);
    state.pdf = null;
    state.totalPages = 0;
    updateReaderChrome();
    await saveProgress("opened", { openedIncrement: true }).catch(() => undefined);
    surface.innerHTML = `
      <iframe class="reader-frame" src="${escapeAttribute(resource.downloadUrl)}" title="${escapeAttribute(resource.title)}"></iframe>
      <p class="form-help">If the preview does not appear, use Original to open the file in a new tab.</p>
    `;
    setStatus("Preview", "muted");
  }
}

async function renderImage(resource) {
  state.pdf = null;
  state.totalPages = 1;
  state.page = 1;
  getElement("#readerSurface").innerHTML = `
    <img class="reader-image" src="${escapeAttribute(resource.downloadUrl)}" alt="${escapeAttribute(resource.title)}" />
  `;
  updateReaderChrome();
  await saveProgress("opened", { openedIncrement: true });
  setStatus(progressLabel(state.progress?.status || "opened"), progressTone(state.progress?.status || "opened"));
}

async function renderFallback(resource) {
  state.pdf = null;
  state.totalPages = 0;
  state.page = 1;
  getElement("#readerSurface").innerHTML = `
    <div class="reader-fallback">
      <span class="material-symbols-rounded" aria-hidden="true">draft</span>
      <h2>This file cannot be previewed inside the browser yet.</h2>
      <p>Word and PowerPoint files need a converter before they can become true in-site reading material. You can still open or download this resource now.</p>
      <a class="primary-action" href="${escapeAttribute(resource.downloadUrl)}" target="_blank" rel="noreferrer">
        <span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>
        Open original file
      </a>
    </div>
  `;
  updateReaderChrome();
  await saveProgress("opened", { openedIncrement: true });
  setStatus(progressLabel(state.progress?.status || "opened"), progressTone(state.progress?.status || "opened"));
}

async function loadResource() {
  const resourceId = new URLSearchParams(window.location.search).get("resource");
  const session = getMemberSession();

  if (!session?.memberId) {
    setStatus("Check in needed", "muted");
    setText("#readerTitle", "Class check-in required");
    setText("#readerNote", "Open the dashboard first so the portal can verify your name and matric number.");
    getElement("#readerSurface").innerHTML = `<a class="primary-action" href="./dashboard.html">Go to dashboard</a>`;
    return;
  }

  if (!resourceId) {
    setStatus("Missing file", "muted");
    setText("#readerTitle", "No resource selected");
    setText("#readerNote", "Choose a resource from the course page.");
    getElement("#readerSurface").innerHTML = `<a class="primary-action" href="./courses.html">Browse courses</a>`;
    return;
  }

  state.backend = await createBackend();
  const { resource, progress } = await state.backend.getReaderResource(resourceId);
  state.resource = resource;
  state.progress = progress;

  setText("#readerCourse", `${resource.courseCode || "Class"} ${resource.type || "Resource"}`);
  setText("#readerTitle", resource.title || "Untitled resource");
  setText("#readerNote", resource.note || resource.fileName || "Class material");
  setStatus(progressLabel(progress?.status || "opened"), progressTone(progress?.status || "opened"));
  updateReaderChrome();

  const kind = resourceKind(resource);
  if (kind === "pdf") await renderPdf(resource);
  else if (kind === "image") await renderImage(resource);
  else await renderFallback(resource);
}

function connectReaderControls() {
  getElement("#readerPrev")?.addEventListener("click", async () => {
    if (!state.pdf || state.page <= 1) return;
    state.page -= 1;
    await renderPdfPage();
  });

  getElement("#readerNext")?.addEventListener("click", async () => {
    if (!state.pdf || state.page >= state.totalPages) return;
    state.page += 1;
    await renderPdfPage();
  });

  getElement("#readerZoomOut")?.addEventListener("click", async () => {
    if (!state.pdf) return;
    state.zoom = Math.max(0.7, state.zoom - 0.12);
    await renderPdfPage();
  });

  getElement("#readerZoomIn")?.addEventListener("click", async () => {
    if (!state.pdf) return;
    state.zoom = Math.min(2.1, state.zoom + 0.12);
    await renderPdfPage();
  });

  getElement("#readerDone")?.addEventListener("click", async () => {
    const progress = await saveProgress("done");
    state.progress = progress || { status: "done" };
    setStatus("Done", "success");
  });

  getElement("#readerUrgent")?.addEventListener("click", async () => {
    const progress = await saveProgress("urgent");
    state.progress = progress || { status: "urgent" };
    setStatus("Urgent", "muted");
  });

  document.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowLeft") getElement("#readerPrev")?.click();
    if (event.key === "ArrowRight") getElement("#readerNext")?.click();
  });
}

connectReaderControls();
loadResource().catch((error) => {
  console.error(error);
  setStatus("Error", "muted");
  setText("#readerTitle", "Reader could not open this resource");
  setText("#readerNote", error.message || "Please go back and try again.");
  getElement("#readerSurface").innerHTML = `<a class="primary-action" href="./courses.html">Back to courses</a>`;
});
