/* SUPABASE CONFIG: Paste these values from Supabase Project Settings > API.
   The anon key is safe for browser use when Row Level Security policies are active. */
export const supabaseConfig = {
  url: "https://rfrlddiebyfojnzbfldy.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmxkZGllYnlmb2puemJmbGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDQ3MDgsImV4cCI6MjA5NDg4MDcwOH0.3nHfDHpkVPUNyxz65_IOPqx8H0F1QA6kxzi1AHFI7oU",
  storageBucket: "class-resources",
};

export function isSupabaseConfigured() {
  return Boolean(
    supabaseConfig.url &&
    supabaseConfig.anonKey &&
    !supabaseConfig.url.startsWith("PASTE_") &&
    !supabaseConfig.anonKey.startsWith("PASTE_"),
  );
}
