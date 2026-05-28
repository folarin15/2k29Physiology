import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://2k29physiology.pxxl.click",
  "http://localhost:4177",
  "http://127.0.0.1:4177",
]);

const storageBucket = "class-resources";
const supportedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

type ExtractRequest = {
  action?: "extract-resource" | "backfill";
  resourceId?: string;
  limit?: number;
};

type ResourceRow = {
  id: string;
  title: string;
  course_code: string;
  course_title?: string;
  type?: string;
  note?: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  storage_path: string;
};

type ExtractedQuestion = {
  topic?: string;
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  confidence?: number;
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://2k29physiology.pxxl.click";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown, maxLength = 600) {
  return String(value || "")
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanUuid(value: unknown) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

function fileExtension(fileName = "") {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function mimeType(resource: ResourceRow) {
  const extension = fileExtension(resource.file_name);
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function extractJsonText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const output = (value as { output_text?: unknown }).output_text;
  if (typeof output === "string") return output;

  const chunks: string[] = [];
  const response = value as { output?: Array<{ content?: Array<{ text?: string }> }> };
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

function fallbackQuestions(resource: ResourceRow) {
  const topic = cleanText(resource.title.replace(resource.course_code, "").replace(/[:_-]+/g, " "), 80) || "General";
  const base = cleanText(resource.note || resource.title || resource.file_name, 160);
  return [
    {
      topic,
      question: `Which area should you focus on when reviewing ${cleanText(resource.title, 100)}?`,
      options: ["Main concepts in the uploaded material", "Only the file name", "Unrelated class announcements", "Course rep contact details"],
      answer: "Main concepts in the uploaded material",
      explanation: base || "Review the uploaded material and identify its main concepts before attempting practice questions.",
      difficulty: "Easy",
      confidence: 0.35,
    },
  ];
}

async function requireStaff(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization) throw new Error("Authentication required.");

  const authedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authedClient.auth.getUser();

  if (userError || !user) throw new Error("Authentication required.");

  const { data: role, error: roleError } = await authedClient
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role || !["rep", "admin"].includes(role.role)) throw new Error("Only course reps and admin can extract questions.");
  return user;
}

async function loadResourceFile(supabase: ReturnType<typeof createClient>, resource: ResourceRow) {
  const { data: signed, error: signedError } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(resource.storage_path, 60 * 5);

  if (signedError || !signed?.signedUrl) throw signedError || new Error("Could not sign resource file.");
  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error(`Could not fetch resource file: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function aiExtractQuestions(resource: ResourceRow, fileBytes: Uint8Array) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) return fallbackQuestions(resource);

  const extension = fileExtension(resource.file_name);
  const dataUrl = `data:${mimeType(resource)};base64,${bytesToBase64(fileBytes)}`;
  const fileContent =
    extension === "pdf"
      ? { type: "input_file", filename: resource.file_name, file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are building a trusted CBT practice bank for a class portal. Extract real questions when present. If the resource is a slide or note, create likely study questions strictly from visible content. No emojis. Return only JSON.",
        },
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "input_text",
              text: JSON.stringify({
                courseCode: resource.course_code,
                courseTitle: resource.course_title || "",
                resourceTitle: resource.title,
                resourceType: resource.type || "",
                note: resource.note || "",
                instruction:
                  "Return 6-10 multiple-choice questions. Each must have exactly 4 options, one exact answer from options, short explanation, topic, difficulty, and confidence 0-1.",
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "question_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              questions: {
                type: "array",
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    topic: { type: "string" },
                    question: { type: "string" },
                    options: {
                      type: "array",
                      minItems: 4,
                      maxItems: 4,
                      items: { type: "string" },
                    },
                    answer: { type: "string" },
                    explanation: { type: "string" },
                    difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
                    confidence: { type: "number" },
                  },
                  required: ["topic", "question", "options", "answer", "explanation", "difficulty", "confidence"],
                },
              },
            },
            required: ["questions"],
          },
        },
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "AI extraction failed.");

  const parsed = JSON.parse(extractJsonText(result) || "{}") as { questions?: ExtractedQuestion[] };
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions.length ? questions : fallbackQuestions(resource);
}

function normalizeQuestions(resource: ResourceRow, rawQuestions: ExtractedQuestion[]) {
  return rawQuestions
    .map((item) => {
      const options = [...new Set((item.options || []).map((option) => cleanText(option, 220)).filter(Boolean))].slice(0, 4);
      const answer = cleanText(item.answer, 220);
      if (!cleanText(item.question, 800) || options.length !== 4 || !options.includes(answer)) return null;

      return {
        resource_id: resource.id,
        course_code: resource.course_code,
        topic: cleanText(item.topic || "General", 80) || "General",
        question_text: cleanText(item.question, 900),
        options,
        correct_answer: answer,
        explanation: cleanText(item.explanation || "Review the source material for the reasoning.", 600),
        difficulty: ["Easy", "Medium", "Hard"].includes(String(item.difficulty)) ? item.difficulty : "Medium",
        confidence: Math.max(0, Math.min(1, Number(item.confidence || 0.6))),
        source_hint: cleanText(resource.title, 160),
        status: Number(item.confidence || 0.6) >= 0.55 ? "published" : "review",
      };
    })
    .filter(Boolean);
}

async function extractResource(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  resource: ResourceRow,
  userId: string,
) {
  const extension = fileExtension(resource.file_name);
  const supported = supportedExtensions.has(extension);

  const { data: job } = await supabase
    .from("question_extraction_jobs")
    .upsert(
      {
        resource_id: resource.id,
        status: supported ? "processing" : "skipped",
        error: supported ? null : "Only PDFs and images can be extracted automatically right now.",
        created_by_user_id: userId,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "resource_id" },
    )
    .select("*")
    .single();

  if (!supported) return { resourceId: resource.id, status: "skipped", questionCount: 0 };

  try {
    if (Number(resource.file_size || 0) > 18 * 1024 * 1024) {
      throw new Error("File is too large for fast automatic extraction. Split or compress it first.");
    }

    const fileBytes = await loadResourceFile(supabase, resource);
    const questions = normalizeQuestions(resource, await aiExtractQuestions(resource, fileBytes));

    await supabase.from("question_bank").delete().eq("resource_id", resource.id);
    if (questions.length) {
      const { error: insertError } = await supabase.from("question_bank").insert(questions);
      if (insertError) throw insertError;
    }

    await supabase
      .from("question_extraction_jobs")
      .update({
        status: questions.length ? "completed" : "failed",
        question_count: questions.length,
        error: questions.length ? null : "No usable questions were returned.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job?.id);

    return { resourceId: resource.id, status: questions.length ? "completed" : "failed", questionCount: questions.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question extraction failed.";
    await supabase
      .from("question_extraction_jobs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("resource_id", resource.id);
    return { resourceId: resource.id, status: "failed", questionCount: 0, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(req, { error: "Extractor environment is incomplete." }, 500);
    }

    const user = await requireStaff(req, supabaseUrl, anonKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = (await req.json()) as ExtractRequest;
    const action = body.action || "extract-resource";

    if (action === "extract-resource") {
      const resourceId = cleanUuid(body.resourceId);
      if (!resourceId) return jsonResponse(req, { error: "Resource not found." }, 404);

      const { data: resource, error } = await supabase.from("resources").select("*").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      if (!resource) return jsonResponse(req, { error: "Resource not found." }, 404);
      return jsonResponse(req, await extractResource(req, supabase, resource as ResourceRow, user.id));
    }

    const limit = Math.max(1, Math.min(5, Number(body.limit || 3)));
    const { data: resources, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    const resourceIds = (resources || []).map((resource) => resource.id);
    const { data: jobs, error: jobsError } = resourceIds.length
      ? await supabase.from("question_extraction_jobs").select("resource_id, status").in("resource_id", resourceIds)
      : { data: [], error: null };
    if (jobsError) throw jobsError;
    const jobByResource = new Map((jobs || []).map((job) => [String(job.resource_id), String(job.status)]));

    const candidates = (resources || [])
      .filter((resource) => supportedExtensions.has(fileExtension(resource.file_name)))
      .filter((resource) => !["completed", "processing"].includes(jobByResource.get(String(resource.id)) || ""))
      .slice(0, limit);

    const results = [];
    for (const resource of candidates) {
      results.push(await extractResource(req, supabase, resource as ResourceRow, user.id));
    }

    return jsonResponse(req, { processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question extractor failed.";
    const status = message.includes("Authentication") ? 401 : message.includes("Only course") ? 403 : 400;
    return jsonResponse(req, { error: message }, status);
  }
});
