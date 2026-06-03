import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, "dist");

const rootFiles = [
  "_headers",
  "admin.html",
  "app.js",
  "courses.html",
  "dashboard.html",
  "data.js",
  "exam-room.html",
  "exam.html",
  "index.html",
  "OneSignalSDKWorker.js",
  "quiz.html",
  "reader.html",
  "reader.js",
  "rep.html",
  "reps.html",
  "robots.txt",
  "site.webmanifest",
  "styles.css",
  "suggestions.html",
  "supabase-config.js",
  "supabase-service.js",
  "timetable.html",
];

const folders = ["assets", "K29.admin", "K29.rep"];

async function copyIfExists(source, target) {
  try {
    await stat(source);
  } catch {
    return;
  }
  await cp(source, target, { recursive: true });
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of rootFiles) {
  await copyIfExists(join(root, file), join(output, file));
}

for (const folder of folders) {
  await copyIfExists(join(root, folder), join(output, folder));
}

const copied = await readdir(output);
console.log(`Static build ready in dist/ with ${copied.length} top-level items.`);
