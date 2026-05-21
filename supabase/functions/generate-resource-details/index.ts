import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedTypes = new Set(["Slide", "Note", "Practical", "Past Question", "Assignment", "Link"]);

type GenerateRequest = {
  courseCode?: string;
  courseTitle?: string;
  fileName?: string;
  existingTitle?: string;
  existingNote?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback)
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackDetails(body: GenerateRequest) {
  const courseCode = cleanText(body.courseCode, "Course");
  const fileName = cleanText(body.fileName, "Resource").replace(/\.[^.]+$/, "");
  const cleanedName = fileName.replace(/[_-]+/g, " ").replace(/\s+\(\d+\)$/i, "").trim();
  const isPastQuestion = /\b(pq|past|mock|exam|test|ca|question)\b/i.test(cleanedName);

  return {
    title: `${courseCode}: ${cleanedName}`,
    context: isPastQuestion
      ? "Practice material for revision, self-testing, and exam preparation."
      : "Class material for reviewing the topic and following the course sequence.",
    type: isPastQuestion ? "Past Question" : "Slide",
  };
}

function extractJsonText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const output = (value as { output_text?: unknown }).output_text;
  if (typeof output === "string") return output;

  const chunks: string[] = [];
  const response = value as { output?: Array<{ content?: Array<{ text?: string; type?: string }> }> };
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase function environment is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const { data: role, error: roleError } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return jsonResponse({ error: roleError.message }, 500);
    }

    if (!role || !["rep", "admin"].includes(role.role)) {
      return jsonResponse({ error: "Only course reps and admin can generate upload details." }, 403);
    }

    const body = (await req.json()) as GenerateRequest;
    const fallback = fallbackDetails(body);

    if (!openAiKey) {
      return jsonResponse({ ...fallback, generatedBy: "fallback" });
    }

    const prompt = {
      courseCode: cleanText(body.courseCode),
      courseTitle: cleanText(body.courseTitle),
      fileName: cleanText(body.fileName),
      existingTitle: cleanText(body.existingTitle),
      existingNote: cleanText(body.existingNote),
      categories: [...allowedTypes],
    };

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
              "You organize a class resource bank. Return only JSON with title, context, and type. No emojis. Professional but relaxed. Context must be under 30 words. Type must be one of: Slide, Note, Practical, Past Question, Assignment, Link.",
          },
          {
            role: "user",
            content: JSON.stringify(prompt),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "resource_details",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                context: { type: "string" },
                type: { type: "string", enum: [...allowedTypes] },
              },
              required: ["title", "context", "type"],
            },
          },
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonResponse({ ...fallback, generatedBy: "fallback", aiError: result.error?.message || "AI request failed." });
    }

    const parsed = JSON.parse(extractJsonText(result) || "{}");
    const type = allowedTypes.has(cleanText(parsed.type)) ? cleanText(parsed.type) : fallback.type;

    return jsonResponse({
      title: cleanText(parsed.title, fallback.title).slice(0, 120),
      context: cleanText(parsed.context, fallback.context).slice(0, 220),
      type,
      generatedBy: "openai",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-title failed.";
    return jsonResponse({ error: message }, 400);
  }
});
