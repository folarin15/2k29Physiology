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
    | "save-resource-feedback";
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
        .select("id")
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
