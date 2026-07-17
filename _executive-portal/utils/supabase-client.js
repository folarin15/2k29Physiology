// ============================================================
// PhysioK29 — Shared Supabase Client
// ============================================================

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let clientPromise = null;

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) => {
      const config = getSupabaseConfig();
      return createClient(config.url, config.anonKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      });
    });
  }
  return clientPromise;
}

export function getSupabaseConfig() {
  return {
    url: "https://rfrlddiebyfojnzbfldy.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmxkZGllYnlmb2puemJmbGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDQ3MDgsImV4cCI6MjA5NDg4MDcwOH0.3nHfDHpkVPUNyxz65_IOPqx8H0F1QA6kxzi1AHFI7oU",
    storageBucket: "class-resources",
  };
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && !config.url.startsWith("PASTE_") && !config.anonKey.startsWith("PASTE_"));
}

export function getStorageBucket() {
  return getSupabaseConfig().storageBucket;
}
