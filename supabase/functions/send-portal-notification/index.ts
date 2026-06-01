import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://2k29physiology.pxxl.click",
  "http://localhost:4177",
  "http://127.0.0.1:4177",
]);

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

type NotificationRequest = {
  type?: "resource" | "announcement";
  title?: string;
  message?: string;
  courseCode?: string;
  resourceType?: string;
  url?: string;
};

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function preview(value: unknown, maxLength = 130) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildNotification(body: NotificationRequest) {
  const url = cleanText(body.url, "https://2k29physiology.pxxl.click/dashboard.html");

  if (body.type === "resource") {
    const title = cleanText(body.title, "New resource");
    const courseCode = cleanText(body.courseCode, "Class");
    return {
      heading: "New slide/resource posted",
      content: `${courseCode}: ${title}`,
      url,
    };
  }

  if (body.type === "announcement") {
    return {
      heading: cleanText(body.title, "New class announcement"),
      content: preview(body.message || "Open PhysioK29 to read the latest update."),
      url,
    };
  }

  throw new Error("Unsupported notification type.");
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(req, { error: "Supabase function environment is incomplete." }, 500);
    }

    if (!oneSignalAppId || !oneSignalRestKey) {
      return jsonResponse(req, { error: "OneSignal secrets are not configured." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) {
      return jsonResponse(req, { error: "Missing authorization header." }, 401);
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
      return jsonResponse(req, { error: "Authentication required." }, 401);
    }

    const { data: role, error: roleError } = await supabase
      .from("staff_roles")
      .select("role, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return jsonResponse(req, { error: roleError.message }, 500);
    }

    if (!role || !["rep", "admin"].includes(role.role)) {
      return jsonResponse(req, { error: "Only course reps and admin can send notifications." }, 403);
    }

    const notification = buildNotification((await req.json()) as NotificationRequest);
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${oneSignalRestKey}`,
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        target_channel: "push",
        included_segments: ["Subscribed Users"],
        headings: { en: notification.heading },
        contents: { en: notification.content },
        url: notification.url,
        data: {
          source: "physiok29",
          sentBy: role.display_name || user.email || "Course rep",
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonResponse(
        req,
        {
          error: "OneSignal rejected the notification.",
          details: result,
        },
        response.status,
      );
    }

    return jsonResponse(req, { ok: true, notificationId: result.id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification failed.";
    return jsonResponse(req, { error: message }, 400);
  }
});
