import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://rfrlddiebyfojnzbfldy.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  console.error("Set it with:  $env:SUPABASE_SERVICE_ROLE_KEY = 'your-key-here'");
  process.exit(1);
}

const BATCH_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FILLERS = [
  "None of the above",
  "All of the above",
  "Cannot be determined from the given information",
  "Insufficient data to answer",
];

function generateOptions(correctAnswer) {
  const opts = [correctAnswer];
  for (const filler of FILLERS) {
    if (!opts.includes(filler)) opts.push(filler);
    if (opts.length === 4) break;
  }
  while (opts.length < 4) {
    opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
  }
  return shuffle(opts);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function clearExisting() {
  const { count, error } = await supabase
    .from("question_bank")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.log("Could not count existing questions (table may be empty):", error.message);
    return;
  }

  console.log(`Existing questions in DB: ${count}`);
  if (count > 0) {
    console.log("Clearing existing questions...");
    const { error: delErr } = await supabase
      .from("question_bank")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (delErr) {
      console.error("Could not clear table:", delErr.message);
      console.log("Will insert alongside existing data.");
    } else {
      console.log("Existing questions cleared.");
    }
  }
}

async function main() {
  console.log("Reading quiz-bank.json...");
  const raw = readFileSync(resolve(root, "quiz-bank.json"), "utf-8");
  const bank = JSON.parse(raw);

  const questions = bank.questions || [];
  console.log(`Total questions in JSON: ${questions.length}`);

  const withOptions = questions.filter((q) => q.options?.length >= 2);
  const withoutOptions = questions.filter((q) => !q.options || q.options.length < 2);
  console.log(`Questions with options: ${withOptions.length}`);
  console.log(`Questions without options: ${withoutOptions.length} (will generate placeholder options)`);

  await clearExisting();

  let inserted = 0;
  let failed = 0;
  let batch = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = q.options?.length >= 2 ? q.options : generateOptions(q.correctAnswer);
    const shuffledOptions = shuffle(options);

    const row = {
      course_code: q.courseCode,
      topic: q.topic || "General",
      question_text: q.question,
      options: JSON.stringify(shuffledOptions),
      correct_answer: q.correctAnswer,
      explanation: q.explanation || "",
      difficulty: ["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium",
      source_hint: null,
      confidence: 0.95,
      status: "published",
    };

    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("question_bank").insert(batch);
      if (error) {
        console.error(`\nBatch insert failed at index ${i}:`, error.message);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
      process.stdout.write(`\rProgress: ${inserted + failed} / ${questions.length} (${inserted} inserted, ${failed} failed)`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from("question_bank").insert(batch);
    if (error) {
      console.error(`\nFinal batch insert failed:`, error.message);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\rProgress: ${inserted + failed} / ${questions.length} (${inserted} inserted, ${failed} failed)`);
  }

  console.log(`\n\nDone. Inserted: ${inserted}, Failed: ${failed}`);

  const { count: finalCount, error: finalError } = await supabase
    .from("question_bank")
    .select("id", { count: "exact", head: true });

  if (finalError) {
    console.error("Verification error:", finalError.message);
  } else {
    console.log(`\nTotal questions in question_bank table: ${finalCount}`);
    console.log(finalCount === questions.length ? "All questions seeded successfully!" : `Warning: Expected ${questions.length}, got ${finalCount}`);
  }

  const { data: breakdown } = await supabase
    .from("question_bank")
    .select("course_code");

  if (breakdown) {
    const counts = {};
    breakdown.forEach((row) => {
      counts[row.course_code] = (counts[row.course_code] || 0) + 1;
    });
    console.log("\nPer-course breakdown:");
    for (const [code, count] of Object.entries(counts).sort()) {
      console.log(`  ${code}: ${count}`);
    }
  }
}

main().catch((err) => {
  console.error("\nSeed script failed:", err);
  process.exit(1);
});
