import { supabase } from "@/lib/supabase";
import type { Itinerary, ItineraryPlan } from "@/types/itinerary";

/**
 * The signed-in user's saved itineraries (`itineraries` table, migration
 * 0004). The travel agent creates them; the app reads and deletes them here
 * directly. Row Level Security limits every query to the user's own rows.
 */

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

type Row = { id: string; title: string; plan: ItineraryPlan; created_at: string };

const toItinerary = (row: Row): Itinerary => ({
  id: row.id,
  title: row.title,
  plan: row.plan,
  createdAt: row.created_at,
});

export async function fetchItineraries(): Promise<Itinerary[]> {
  const { data, error } = await client()
    .from("itineraries")
    .select("id, title, plan, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toItinerary);
}

/** null when it doesn't exist or isn't the user's. */
export async function fetchItinerary(id: string): Promise<Itinerary | null> {
  const { data, error } = await client()
    .from("itineraries")
    .select("id, title, plan, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    // A malformed id (not a uuid) is "not found", not a crash.
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? toItinerary(data as Row) : null;
}

export async function deleteItinerary(id: string): Promise<void> {
  const { error } = await client().from("itineraries").delete().eq("id", id);
  if (error) throw error;
}
