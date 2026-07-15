import { createClient } from "@supabase/supabase-js"; import { supabaseConfig } from "./supabase-config.js";

async function listTables() {
  const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  const { data, error } = await supabase.rpc("get_tables"); // Trying a common name if it exists
  if (error) {
    console.log("Error fetching tables via RPC:", error.message);
    // Fallback: try to fetch from information_schema if possible, but that usually requires more permissions
  } else {
    console.log("Tables:", data);
  }
}

listTables();
