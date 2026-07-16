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

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function getUpcomingBirthdayRanges() {
  const now = new Date();
  const today = now.toISOString().slice(5, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(5, 10);

  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in7Str = in7Days.toISOString().slice(5, 10);

  const todayMonth = Number(today.split("-")[0]);
  const todayDay = Number(today.split("-")[1]);
  const tomorrowMonth = Number(tomorrowStr.split("-")[0]);
  const tomorrowDay = Number(tomorrowStr.split("-")[1]);

  return { today, tomorrowStr, in7Str, todayMonth, todayDay, tomorrowMonth, tomorrowDay };
}

function monthDayToMMDD(date: Date): number {
  return date.getMonth() * 100 + date.getDate();
}

function dobToMMDD(dob: string): number {
  const parts = dob.split("-");
  return (Number(parts[1]) - 1) * 100 + Number(parts[2]);
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
    const whatsappWebhookUrl = Deno.env.get("WHATSAPP_WEBHOOK_URL") || "";
    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { error: "Backend not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const triggerType = body?.trigger === "manual" ? "manual" : "cron";

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, name, matric_number, full_name, date_of_birth, birthday_photo_url")
      .eq("birthday_registration_completed", true)
      .not("date_of_birth", "is", null);

    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      return jsonResponse(req, { ok: true, message: "No registered birthdays found." });
    }

    const todayMD = monthDayToMMDD(new Date());
    const tomorrowMD = monthDayToMMDD(new Date(Date.now() + 86400000));

    const todayMembers: Array<Record<string, unknown>> = [];
    const tomorrowMembers: Array<Record<string, unknown>> = [];
    const thisWeekMembers: Array<Record<string, unknown>> = [];

    for (const member of members) {
      const md = dobToMMDD(member.date_of_birth as string);
      const diff = md - todayMD;
      if (diff === 0) {
        todayMembers.push(member);
      }
      if (diff === 1 || (todayMD > 1120 && md < 100 && diff + 1200 === 1)) {
        tomorrowMembers.push(member);
      }
      if (diff >= 0 && diff <= 7 || (todayMD > 1120 && md < 100 && diff + 1200 <= 7)) {
        thisWeekMembers.push(member);
      }
    }

    const results: Array<{ type: string; count: number; members: Array<Record<string, unknown>> }> = [];
    if (todayMembers.length) results.push({ type: "today", count: todayMembers.length, members: todayMembers });
    if (tomorrowMembers.length) results.push({ type: "tomorrow", count: tomorrowMembers.length, members: tomorrowMembers });
    if (thisWeekMembers.length) results.push({ type: "this_week", count: thisWeekMembers.length, members: thisWeekMembers });

    if (results.length === 0) {
      return jsonResponse(req, { ok: true, message: "No upcoming birthdays found." });
    }

    let webhookSent = false;
    let webhookResponse = "";

    if (whatsappWebhookUrl && whatsappToken) {
      try {
        let message = "🎂 *PhysioK29 Birthday Reminder*\n\n";

        for (const result of results) {
          const label = result.type === "today" ? "🎉 TODAY" : result.type === "tomorrow" ? "⏰ TOMORROW" : "📅 THIS WEEK";
          message += `*${label}* (${result.count}):\n`;
          for (const m of result.members) {
            const name = (m.full_name || m.name) as string;
            const dob = m.date_of_birth as string;
            const date = new Date(dob.split("-")[0], Number(dob.split("-")[1]) - 1, Number(dob.split("-")[2]));
            const formatted = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
            message += `  • ${name} — ${formatted}\n`;
          }
          message += "\n";
        }

        message += `View dashboard: https://2k29physiology.pxxl.click/K29.admin/\n`;

        const webhookRes = await fetch(whatsappWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${whatsappToken}`,
          },
          body: JSON.stringify({ message }),
        });
        webhookSent = true;
        webhookResponse = `Status ${webhookRes.status}: ${await webhookRes.text().catch(() => "ok")}`;
      } catch (err) {
        webhookResponse = `Error: ${err instanceof Error ? err.message : "webhook failed"}`;
      }
    }

    for (const result of results) {
      const { error: insertError } = await supabase
        .from("birthday_notifications")
        .insert({
          notification_type: result.type,
          member_count: result.count,
          members_json: result.members.map((m) => ({
            id: m.id,
            name: m.name,
            fullName: m.full_name,
            matricNumber: m.matric_number,
            dateOfBirth: m.date_of_birth,
            photoUrl: m.birthday_photo_url,
          })),
          webhook_sent: webhookSent,
          webhook_response: webhookResponse,
          triggered_by: triggerType,
        });

      if (insertError) {
        console.warn(`Failed to log ${result.type} notification:`, insertError.message);
      }
    }

    return jsonResponse(req, {
      ok: true,
      results: results.map((r) => ({ type: r.type, count: r.count })),
      webhookSent,
      webhookResponse,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Birthday check failed.";
    return jsonResponse(req, { error: message }, 400);
  }
});
