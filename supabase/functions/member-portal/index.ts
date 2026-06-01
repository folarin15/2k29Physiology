import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://2k29physiology.pxxl.click",
  "http://localhost:4177",
  "http://127.0.0.1:4177",
]);

const genericVerifyError = "Could not verify this class profile.";
const storageBucket = "class-resources";

type MemberSession = {
  memberId?: string;
  name?: string;
  matricNumber?: string;
};

type MemberRequest = {
  action?:
    | "register"
    | "refresh"
    | "portal-data"
    | "submit-suggestion"
    | "save-push-status"
    | "reader-resource"
    | "save-resource-progress"
    | "save-resource-feedback"
    | "quiz-setup"
    | "quiz-questions"
    | "submit-quiz-attempt";
  name?: string;
  matricNumber?: string;
  memberSession?: MemberSession;
  category?: string;
  message?: string;
  enabled?: boolean;
  subscriptionId?: string;
  resourceId?: string;
  status?: "opened" | "reading" | "urgent" | "done" | "studying";
  helpful?: boolean;
  currentPage?: number;
  totalPages?: number;
  openedIncrement?: boolean;
  mode?: "practice" | "exam";
  courseCode?: string;
  topic?: string;
  limit?: number;
  durationSeconds?: number;
  answers?: Array<{ questionId?: string; selectedAnswer?: string }>;
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

function cleanName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function cleanMatric(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function cleanText(value: unknown, maxLength: number) {
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

function cleanPageNumber(value: unknown) {
  const number = Math.trunc(Number(value || 0));
  if (!Number.isFinite(number) || number < 1) return null;
  return Math.min(number, 10000);
}

function cleanStatus(value: unknown) {
  const status = String(value || "opened").toLowerCase();
  if (status === "studying") return "reading";
  return ["opened", "reading", "urgent", "done"].includes(status) ? status : "opened";
}

function statusRank(status: string) {
  return { opened: 1, reading: 2, urgent: 3, done: 4 }[status] || 1;
}

function getClientAddress(req: Request) {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createSignedResourceRows(supabase: ReturnType<typeof createClient>, rows: Record<string, unknown>[]) {
  return Promise.all(
    rows.map(async (row) => {
      const storagePath = String(row.storage_path || "");
      if (!storagePath) return { ...row, download_url: "" };

      const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 60 * 60);
      return {
        ...row,
        download_url: error ? "" : data?.signedUrl || "",
      };
    }),
  );
}

function getHelpfulCounts(rows: Record<string, unknown>[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    if (!row.helpful) return counts;
    const resourceId = String(row.resource_id || "");
    counts[resourceId] = (counts[resourceId] || 0) + 1;
    return counts;
  }, {});
}

function attachEngagement(
  rows: Record<string, unknown>[],
  progressRows: Record<string, unknown>[] = [],
  allFeedbackRows: Record<string, unknown>[] = [],
  ownFeedbackRows: Record<string, unknown>[] = [],
) {
  const progressByResource = new Map(progressRows.map((row) => [String(row.resource_id), row]));
  const feedbackByResource = new Map(ownFeedbackRows.map((row) => [String(row.resource_id), row]));
  const helpfulCounts = getHelpfulCounts(allFeedbackRows);

  return rows.map((row) => {
    const resourceId = String(row.id || "");
    const ownFeedback = feedbackByResource.get(resourceId);

    return {
      ...row,
      progress: progressByResource.get(resourceId) || null,
      feedback: {
        helpful: Boolean(ownFeedback?.helpful),
        helpful_count: helpfulCounts[resourceId] || 0,
      },
    };
  });
}

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  action: string,
  clientKey: string,
  matricNumber: string,
  success: boolean,
) {
  await supabase
    .from("member_access_attempts")
    .insert({
      action,
      client_key: clientKey,
      matric_number: matricNumber || null,
      success,
    })
    .then(({ error }) => {
      if (error) console.warn("Could not log member access attempt:", error.message);
    });
}

async function tooManyFailedAttempts(supabase: ReturnType<typeof createClient>, action: string, clientKey: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("member_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("client_key", clientKey)
    .eq("success", false)
    .gte("created_at", since);

  if (error) return false;
  return Number(count || 0) >= 12;
}

async function verifyMember(supabase: ReturnType<typeof createClient>, session: MemberSession | undefined) {
  const memberId = String(session?.memberId || "");
  const name = cleanName(session?.name);
  const matricNumber = cleanMatric(session?.matricNumber);

  if (!memberId || !name || !matricNumber) return null;

  const { data, error } = await supabase.rpc("refresh_member_seen", {
    p_member_id: memberId,
    p_name: name,
    p_matric_number: matricNumber,
  });

  if (error || data === false) return null;

  const { data: member } = await supabase
    .from("members")
    .select("id, name, matric_number, notification_enabled, onesignal_subscription_id")
    .eq("id", memberId)
    .eq("matric_number", matricNumber)
    .maybeSingle();

  return member || null;
}

function cleanCourseCode(value: unknown) {
  return cleanText(value, 20).toUpperCase();
}

function cleanQuizMode(value: unknown) {
  return value === "exam" ? "exam" : "practice";
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function publicQuestion(row: Record<string, unknown>) {
  return {
    id: row.id,
    courseCode: row.course_code,
    topic: row.topic,
    question: row.question_text,
    options: shuffle((row.options as string[]) || []),
    difficulty: row.difficulty,
    sourceHint: row.source_hint,
  };
}

function motivationText(mode: string, score: number, total: number, weakTopics: string[]) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  if (!total) return "Start small. One honest attempt is still progress.";
  if (percent >= 85) return `Sharp work. ${percent}% is strong. Keep the rhythm and protect the topics you already own.`;
  if (percent >= 60) return `Good push. ${percent}% means the foundation is forming. Revisit ${weakTopics[0] || "your missed topics"} and run it again.`;
  if (mode === "exam") return `This mock did its job. ${percent}% shows what to repair before the real thing. Start with ${weakTopics[0] || "the toughest topic"} and climb.`;
  return `No panic. ${percent}% is feedback, not failure. Review ${weakTopics[0] || "one weak topic"} and try a shorter quiz next.`;
}

async function studySummary(supabase: ReturnType<typeof createClient>, memberId: string) {
  const { data: events } = await supabase
    .from("study_events")
    .select("created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(120);

  const dayKeys = new Set(
    (events || []).map((event) => new Date(String(event.created_at)).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dayKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const { data: weakRows } = await supabase
    .from("topic_performance")
    .select("course_code, topic, attempts, correct")
    .eq("member_id", memberId)
    .gt("attempts", 0)
    .order("updated_at", { ascending: false })
    .limit(40);

  const weakTopics = (weakRows || [])
    .map((row) => ({
      courseCode: row.course_code,
      topic: row.topic,
      attempts: row.attempts,
      correct: row.correct,
      accuracy: Number(row.attempts || 0) ? Math.round((Number(row.correct || 0) / Number(row.attempts)) * 100) : 0,
    }))
    .filter((row) => row.accuracy < 70)
    .slice(0, 6);

  return { streak, weakTopics };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { error: "Portal backend is not fully configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = (await req.json()) as MemberRequest;
    const action = body.action || "portal-data";
    const clientKey = await sha256(`${getClientAddress(req)}:${req.headers.get("User-Agent") || ""}`);

    if (action === "register") {
      const name = cleanName(body.name);
      const matricNumber = cleanMatric(body.matricNumber);

      if (await tooManyFailedAttempts(supabase, "register", clientKey)) {
        return jsonResponse(req, { error: "Too many attempts. Please try again later." }, 429);
      }

      const { data: memberId, error } = await supabase.rpc("register_member", {
        p_name: name,
        p_matric_number: matricNumber,
      });

      const success = Boolean(memberId && !error);
      await logAttempt(supabase, "register", clientKey, matricNumber, success);

      if (!success) {
        return jsonResponse(req, { error: genericVerifyError }, 403);
      }

      const { data: member } = await supabase
        .from("members")
        .select("id, name, matric_number")
        .eq("id", memberId)
        .maybeSingle();

      return jsonResponse(req, {
        memberId,
        name: member?.name || name,
        matricNumber: member?.matric_number || matricNumber,
      });
    }

    if (action === "refresh") {
      const member = await verifyMember(supabase, body.memberSession);
      if (!member) return jsonResponse(req, { error: genericVerifyError }, 403);
      return jsonResponse(req, {
        ok: true,
        name: member.name,
        matricNumber: member.matric_number,
        notificationEnabled: Boolean(member.notification_enabled),
        oneSignalSubscriptionId: member.onesignal_subscription_id || "",
      });
    }

    const member = await verifyMember(supabase, body.memberSession);
    if (!member) {
      return jsonResponse(req, { error: genericVerifyError }, 403);
    }

    if (action === "portal-data") {
      const { data: resources, error: resourceError } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

      if (resourceError) throw resourceError;

      const { data: announcements, error: announcementError } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);

      if (announcementError) throw announcementError;

      const { data: progressRows, error: progressError } = await supabase
        .from("resource_progress")
        .select("*")
        .eq("member_id", member.id);

      if (progressError) throw progressError;

      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("resource_feedback")
        .select("resource_id, member_id, helpful, updated_at");

      if (feedbackError) throw feedbackError;

      const signedResources = await createSignedResourceRows(supabase, resources || []);
      const ownFeedbackRows = (feedbackRows || []).filter((row) => String(row.member_id) === String(member.id));

      return jsonResponse(req, {
        resources: attachEngagement(signedResources, progressRows || [], feedbackRows || [], ownFeedbackRows),
        announcements: announcements || [],
      });
    }

    if (action === "reader-resource") {
      const resourceId = cleanUuid(body.resourceId);
      if (!resourceId) return jsonResponse(req, { error: "Resource not found." }, 404);

      const { data: resource, error: resourceError } = await supabase
        .from("resources")
        .select("*")
        .eq("id", resourceId)
        .maybeSingle();

      if (resourceError) throw resourceError;
      if (!resource) return jsonResponse(req, { error: "Resource not found." }, 404);

      const { data: progress, error: progressError } = await supabase
        .from("resource_progress")
        .select("*")
        .eq("member_id", member.id)
        .eq("resource_id", resourceId)
        .maybeSingle();

      if (progressError) throw progressError;

      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("resource_feedback")
        .select("resource_id, member_id, helpful, updated_at")
        .eq("resource_id", resourceId);

      if (feedbackError) throw feedbackError;

      const [signedResource] = await createSignedResourceRows(supabase, [resource]);
      const ownFeedbackRows = (feedbackRows || []).filter((row) => String(row.member_id) === String(member.id));
      return jsonResponse(req, {
        resource: attachEngagement([signedResource], progress ? [progress] : [], feedbackRows || [], ownFeedbackRows)[0],
        progress: progress || null,
      });
    }

    if (action === "save-resource-progress") {
      const resourceId = cleanUuid(body.resourceId);
      if (!resourceId) return jsonResponse(req, { error: "Resource not found." }, 404);

      const { data: resource, error: resourceError } = await supabase
        .from("resources")
        .select("id, course_code")
        .eq("id", resourceId)
        .maybeSingle();

      if (resourceError) throw resourceError;
      if (!resource) return jsonResponse(req, { error: "Resource not found." }, 404);

      const requestedStatus = cleanStatus(body.status);
      const currentPage = cleanPageNumber(body.currentPage);
      const totalPages = cleanPageNumber(body.totalPages);
      const progressPercent =
        totalPages && currentPage ? Math.min(100, Math.round((currentPage / totalPages) * 10000) / 100) : 0;

      const { data: existing, error: existingError } = await supabase
        .from("resource_progress")
        .select("*")
        .eq("member_id", member.id)
        .eq("resource_id", resourceId)
        .maybeSingle();

      if (existingError) throw existingError;

      const now = new Date().toISOString();
      const nextStatus =
        existing && statusRank(existing.status) > statusRank(requestedStatus) ? existing.status : requestedStatus;
      const payload = {
        member_id: member.id,
        resource_id: resourceId,
        status: nextStatus,
        opened_count: Number(existing?.opened_count || 0) + (body.openedIncrement ? 1 : 0),
        current_page: currentPage || existing?.current_page || null,
        total_pages: totalPages || existing?.total_pages || null,
        progress_percent: requestedStatus === "done" ? 100 : progressPercent || existing?.progress_percent || 0,
        first_opened_at: existing?.first_opened_at || now,
        last_opened_at: now,
        updated_at: now,
      };

      const { data: saved, error: saveError } = await supabase
        .from("resource_progress")
        .upsert(payload, { onConflict: "member_id,resource_id" })
        .select("*")
        .single();

      if (saveError) throw saveError;

      if (body.openedIncrement || requestedStatus === "done") {
        await supabase.from("study_events").insert({
          member_id: member.id,
          event_type: "read",
          course_code: resource.course_code,
          resource_id: resourceId,
        });
      }

      return jsonResponse(req, { ok: true, progress: saved });
    }

    if (action === "save-resource-feedback") {
      const resourceId = cleanUuid(body.resourceId);
      if (!resourceId) return jsonResponse(req, { error: "Resource not found." }, 404);

      const { data: resource, error: resourceError } = await supabase
        .from("resources")
        .select("id")
        .eq("id", resourceId)
        .maybeSingle();

      if (resourceError) throw resourceError;
      if (!resource) return jsonResponse(req, { error: "Resource not found." }, 404);

      const now = new Date().toISOString();
      const { data: saved, error: saveError } = await supabase
        .from("resource_feedback")
        .upsert(
          {
            member_id: member.id,
            resource_id: resourceId,
            helpful: Boolean(body.helpful),
            updated_at: now,
          },
          { onConflict: "member_id,resource_id" },
        )
        .select("*")
        .single();

      if (saveError) throw saveError;

      const { data: countRows, error: countError } = await supabase
        .from("resource_feedback")
        .select("id")
        .eq("resource_id", resourceId)
        .eq("helpful", true);

      if (countError) throw countError;

      return jsonResponse(req, {
        ok: true,
        feedback: {
          helpful: Boolean(saved.helpful),
          helpful_count: countRows?.length || 0,
        },
      });
    }

    if (action === "quiz-setup") {
      const { data: rows, error } = await supabase
        .from("question_bank")
        .select("course_code, topic, difficulty")
        .eq("status", "published")
        .limit(5000);

      if (error) throw error;

      const courses: Record<string, { count: number; topics: Record<string, number> }> = {};
      for (const row of rows || []) {
        const courseCode = String(row.course_code || "");
        const topic = String(row.topic || "General");
        courses[courseCode] = courses[courseCode] || { count: 0, topics: {} };
        courses[courseCode].count += 1;
        courses[courseCode].topics[topic] = (courses[courseCode].topics[topic] || 0) + 1;
      }

      return jsonResponse(req, {
        courses,
        summary: await studySummary(supabase, member.id),
      });
    }

    if (action === "quiz-questions") {
      const courseCode = cleanCourseCode(body.courseCode);
      const topic = cleanText(body.topic || "", 80);
      const mode = cleanQuizMode(body.mode);
      const limit = Math.max(5, Math.min(120, Number(body.limit || (mode === "exam" ? 30 : 10))));

      let query = supabase
        .from("question_bank")
        .select("id, course_code, topic, question_text, options, difficulty, source_hint")
        .eq("status", "published")
        .eq("course_code", courseCode)
        .limit(200);

      if (topic) query = query.eq("topic", topic);
      const { data: rows, error } = await query;
      if (error) throw error;

      const questions = shuffle(rows || []).slice(0, limit).map(publicQuestion);
      return jsonResponse(req, {
        mode,
        courseCode,
        topic,
        questions,
        summary: await studySummary(supabase, member.id),
      });
    }

    if (action === "submit-quiz-attempt") {
      const mode = cleanQuizMode(body.mode);
      const courseCode = cleanCourseCode(body.courseCode);
      const topic = cleanText(body.topic || "", 80);
      const answers = Array.isArray(body.answers) ? body.answers.slice(0, 80) : [];
      const questionIds = answers.map((answer) => cleanUuid(answer.questionId)).filter(Boolean);

      if (!questionIds.length) return jsonResponse(req, { error: "Submit at least one answer." }, 400);

      const { data: questionRows, error: questionError } = await supabase
        .from("question_bank")
        .select("id, course_code, topic, question_text, options, correct_answer, explanation, difficulty, source_hint")
        .in("id", questionIds)
        .eq("status", "published");

      if (questionError) throw questionError;
      const questionById = new Map((questionRows || []).map((question) => [String(question.id), question]));
      const normalizedAnswers = answers
        .map((answer) => {
          const questionId = cleanUuid(answer.questionId);
          const question = questionById.get(questionId);
          if (!question) return null;
          const selectedAnswer = cleanText(answer.selectedAnswer || "", 240);
          const correct = selectedAnswer === question.correct_answer;
          return { question, selectedAnswer, correct };
        })
        .filter(Boolean) as Array<{ question: Record<string, unknown>; selectedAnswer: string; correct: boolean }>;

      const score = normalizedAnswers.filter((answer) => answer.correct).length;
      const weakTopics = [
        ...new Set(normalizedAnswers.filter((answer) => !answer.correct).map((answer) => String(answer.question.topic || "General"))),
      ];
      const motivation = motivationText(mode, score, normalizedAnswers.length, weakTopics);

      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert({
          member_id: member.id,
          mode,
          course_code: courseCode,
          topic: topic || null,
          question_count: normalizedAnswers.length,
          score,
          duration_seconds: Math.max(0, Math.min(10800, Number(body.durationSeconds || 0))),
          motivation_text: motivation,
          started_at: new Date(Date.now() - Math.max(0, Number(body.durationSeconds || 0)) * 1000).toISOString(),
          submitted_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (attemptError) throw attemptError;

      const answerRows = normalizedAnswers.map((answer) => ({
        attempt_id: attempt.id,
        question_id: answer.question.id,
        selected_answer: answer.selectedAnswer,
        correct: answer.correct,
      }));
      if (answerRows.length) {
        const { error: answersError } = await supabase.from("quiz_answers").insert(answerRows);
        if (answersError) throw answersError;
      }

      const topicStats = new Map<string, { attempts: number; correct: number; courseCode: string; topic: string }>();
      for (const answer of normalizedAnswers) {
        const statKey = `${answer.question.course_code}:${answer.question.topic}`;
        const stat = topicStats.get(statKey) || {
          attempts: 0,
          correct: 0,
          courseCode: String(answer.question.course_code),
          topic: String(answer.question.topic || "General"),
        };
        stat.attempts += 1;
        if (answer.correct) stat.correct += 1;
        topicStats.set(statKey, stat);
      }

      for (const stat of topicStats.values()) {
        const { data: existing } = await supabase
          .from("topic_performance")
          .select("attempts, correct")
          .eq("member_id", member.id)
          .eq("course_code", stat.courseCode)
          .eq("topic", stat.topic)
          .maybeSingle();

        await supabase.from("topic_performance").upsert(
          {
            member_id: member.id,
            course_code: stat.courseCode,
            topic: stat.topic,
            attempts: Number(existing?.attempts || 0) + stat.attempts,
            correct: Number(existing?.correct || 0) + stat.correct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id,course_code,topic" },
        );
      }

      await supabase.from("study_events").insert({
        member_id: member.id,
        event_type: mode === "exam" ? "exam" : "quiz",
        course_code: courseCode,
        attempt_id: attempt.id,
      });

      return jsonResponse(req, {
        attemptId: attempt.id,
        score,
        total: normalizedAnswers.length,
        motivation,
        summary: await studySummary(supabase, member.id),
        results: normalizedAnswers.map((answer) => ({
          questionId: answer.question.id,
          question: answer.question.question_text,
          topic: answer.question.topic,
          selectedAnswer: answer.selectedAnswer,
          correctAnswer: answer.question.correct_answer,
          correct: answer.correct,
          explanation: answer.question.explanation,
          sourceHint: answer.question.source_hint,
        })),
      });
    }

    if (action === "submit-suggestion") {
      const category = cleanText(body.category || "General", 40) || "General";
      const message = cleanText(body.message, 1200);

      if (message.length < 3) {
        return jsonResponse(req, { error: "Write a little more before sending." }, 400);
      }

      const { error } = await supabase.from("suggestions").insert({
        name: member.name,
        matric_number: member.matric_number,
        category,
        message,
      });

      if (error) throw error;
      return jsonResponse(req, { ok: true });
    }

    if (action === "save-push-status") {
      const subscriptionId = cleanText(body.subscriptionId, 180);
      const enabled = Boolean(body.enabled && subscriptionId);

      const { error } = await supabase
        .from("members")
        .update({
          notification_enabled: enabled,
          onesignal_subscription_id: subscriptionId || null,
          notification_last_seen_at: enabled ? new Date().toISOString() : null,
          notification_updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);

      if (error) throw error;
      return jsonResponse(req, { ok: true, notificationEnabled: enabled });
    }

    return jsonResponse(req, { error: "Unsupported action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal request failed.";
    return jsonResponse(req, { error: message }, 400);
  }
});
