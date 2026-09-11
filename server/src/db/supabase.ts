import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

let client: SupabaseClient | null = null;

/**
 * Lazily-created Supabase client using the service role key. Server-side
 * only — this key bypasses row-level security, so it must never reach the
 * Expo app. Throws if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set,
 * so callers (the services layer) can surface a clear 500 instead of a
 * cryptic client error.
 */
export function getSupabase(): SupabaseClient {
  if (!env.isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see server/.env.example)."
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
  }
  return client;
}
