import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ItineraryPlan } from "../src/types/itinerary";

/**
 * Supabase access for the serverless agent.
 *
 * It uses the same public anon key as the app, never the service-role key:
 * each request builds a client that carries the caller's own session token,
 * so the database's Row Level Security treats the agent exactly like the
 * user. It can only save an itinerary into the caller's account, and the
 * usage counters only move through agent_consume() (0004_travel_agent.sql).
 *
 * On Vercel these are the same EXPO_PUBLIC_SUPABASE_* variables the website
 * build reads; locally they come from app/.env.
 */

// Read on use, not at import, so the local dev server can load app/.env first.
function config() {
  return { url: process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = config();
  return Boolean(url && anonKey);
}

export type UserContext = { userId: string; db: SupabaseClient };

/** The signed-in user behind a `Bearer <access token>` header, or null. */
export async function authenticate(authorization: string | null): Promise<UserContext | null> {
  const { url, anonKey } = config();
  if (!url || !anonKey) return null;
  const token = /^Bearer\s+(.+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return null;

  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Asks Supabase Auth to validate the token (signature, expiry, revoked
  // session), rather than trusting whatever the JWT claims.
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, db };
}

/**
 * Counts one message / itinerary against today's allowance. Returns how many
 * are left after it, or "dailyLimit" / "siteLimit" when refused.
 */
export async function consumeUsage(
  db: SupabaseClient,
  kind: "message" | "itinerary"
): Promise<number | "dailyLimit" | "siteLimit"> {
  const { data, error } = await db.rpc("agent_consume", { kind });
  if (error) throw error;
  const left = data as number;
  if (left === -1) return "dailyLimit";
  if (left === -2) return "siteLimit";
  return left;
}

/** Titles of the given itineraries that exist in the caller's account (RLS hides anyone else's). */
export async function fetchItineraryTitles(
  db: SupabaseClient,
  ids: string[]
): Promise<{ id: string; title: string }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("itineraries").select("id, title").in("id", ids);
  if (error) throw error;
  return data as { id: string; title: string }[];
}

export async function insertItinerary(db: SupabaseClient, userId: string, plan: ItineraryPlan): Promise<string> {
  const { data, error } = await db
    .from("itineraries")
    .insert({ user_id: userId, title: plan.title.slice(0, 200), plan })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
