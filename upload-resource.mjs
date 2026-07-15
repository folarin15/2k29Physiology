/**
 * upload-resource.js
 * 
 * Uploads a file to Supabase Storage + inserts into the resources table.
 * 
 * USAGE:
 *   node upload-resource.js <filePath> <courseCode> <title> [type] [week] [lectureDate] [lectureTopic] [lectureVenue]
 * 
 * EXAMPLES:
 *   node upload-resource.js "./slides.pdf" "CHM 102" "Week 1 Slides" "Slide" 1 "2026-07-13" "Electronic Configuration" "Lecture Theatre"
 *   node upload-resource.js "./physics.pdf" "PHY 104" "Week 1 Lecture" "Weekly Lecture" 1 "2026-07-13" "Electricity" "Physics Lab"
 * 
 * FIRST TIME SETUP:
 *   1. npm install @supabase/supabase-js  (already in your project)
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY below, or use env vars
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";

// ── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "https://rfrlddiebyfojnzbfldy.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmxkZGllYnlmb2puemJmbGR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTMwNDcwOCwiZXhwIjoyMDk0ODgwNzA4fQ.c4ztpqs3klIX4lE6AqBB95-azVC-KBy4_--vhsfUGfY";
const BUCKET = "class-resources";

if (SUPABASE_SERVICE_KEY === "PASTE_SERVICE_ROLE_KEY_HERE") {
  console.error("Error: Set SUPABASE_SERVICE_KEY in the script or as an environment variable.");
  process.exit(1);
}

// ── PARSE ARGS ──────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log(`
Usage: node upload-resource.js <filePath> <courseCode> <title> [type] [week] [lectureDate] [lectureTopic] [lectureVenue]

Examples:
  node upload-resource.js "./slides.pdf" "CHM 102" "Week 1 Slides" "Slide" 1 "2026-07-13" "Electronic Configuration" "Lecture Theatre"
  node upload-resource.js "./physics.pdf" "PHY 104" "Week 1 Lecture" "Weekly Lecture" 1 "2026-07-13" "Electricity" "Physics Lab"
  `);
  process.exit(0);
}

const [filePath, courseCode, title, type = "Slide", week, lectureDate, lectureTopic, lectureVenue] = args;

// ── VALIDATE FILE ───────────────────────────────────────────
const resolvedPath = resolve(filePath);
if (!existsSync(resolvedPath)) {
  console.error(`Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

const fileBuffer = readFileSync(resolvedPath);
const fileName = basename(resolvedPath);
const fileSize = fileBuffer.length;
const isLecture = type === "Weekly Lecture";

// Guess MIME type
const ext = fileName.split(".").pop().toLowerCase();
const mimeTypes = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const contentType = mimeTypes[ext] || "application/octet-stream";

console.log(`Uploading: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
console.log(`Course: ${courseCode} | Type: ${type}${isLecture ? ` | Week ${week}` : ""}`);

// ── UPLOAD ──────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
const storagePath = `${courseCode}/${crypto.randomUUID()}-${safeName}`;

console.log(`Storage path: ${storagePath}`);

const { error: uploadError } = await supabase.storage
  .from(BUCKET)
  .upload(storagePath, fileBuffer, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

if (uploadError) {
  console.error("Upload failed:", uploadError.message);
  process.exit(1);
}

console.log("File uploaded to storage.");

// ── INSERT RESOURCE ROW ─────────────────────────────────────
const insertPayload = {
  title: title.trim(),
  course_code: courseCode.trim(),
  course_title: courseCode.trim(),
  type: type.trim(),
  note: isLecture && lectureTopic ? `Week ${week} — ${lectureTopic}` : "",
  file_name: fileName,
  file_size: fileSize,
  file_type: contentType,
  storage_path: storagePath,
  download_url: storagePath,
  uploaded_by: "Admin",
  uploaded_by_user_id: null,
  upload_category: isLecture ? "lecture" : "resource",
};

if (isLecture) {
  insertPayload.week = week ? Number(week) : null;
  insertPayload.lecture_date = lectureDate || null;
  insertPayload.lecture_topic = (lectureTopic || "").trim();
  insertPayload.lecture_venue = (lectureVenue || "").trim();
}

const { data: inserted, error: insertError } = await supabase
  .from("resources")
  .insert(insertPayload)
  .select("id, title, course_code, upload_category, week")
  .single();

if (insertError) {
  console.error("Database insert failed:", insertError.message);
  console.error("File is in storage but no resource row was created.");
  process.exit(1);
}

console.log(`\nDone! Resource created:`);
console.log(`  ID: ${inserted.id}`);
console.log(`  Title: ${inserted.title}`);
console.log(`  Course: ${inserted.course_code}`);
console.log(`  Category: ${inserted.upload_category}`);
if (inserted.week) console.log(`  Week: ${inserted.week}`);
