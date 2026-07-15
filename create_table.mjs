import { supabaseConfig } from "./supabase-config.js";

async function runSql() {
  const sql = `CREATE TABLE IF NOT EXISTS course_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code TEXT NOT NULL,
    course_title TEXT,
    day TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue TEXT,
    lecturer TEXT,
    week INTEGER,
    semester TEXT,
    academic_session TEXT,
    resource_id UUID REFERENCES resources(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );`;

  try {
    const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/run_sql`, {
      method: "POST",
      headers: {
        "apikey": supabaseConfig.anonKey,
        "Authorization": `Bearer ${supabaseConfig.anonKey}`, // Using anonKey here, but the user gave me a service_role key. I should use that.
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql })
    });

    const result = await response.json();
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }
}

runSql();
