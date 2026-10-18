import { supabase } from "@/lib/supabase";

/**
 * A signed-in user's saved campsites, stored in the `favorites` table (one
 * row per user + campsite id). Row Level Security limits every query to the
 * signed-in user's own rows, so the user id here only says which rows to
 * write; it can't be used to read or change anyone else's.
 */

function client() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await client().from("favorites").select("campsite_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((row) => row.campsite_id as string);
}

export async function addFavorites(userId: string, campsiteIds: string[]): Promise<void> {
  if (campsiteIds.length === 0) return;
  // Upsert so re-adding an id that is already saved (e.g. when guest
  // favorites are merged on login) is a no-op rather than a key error.
  const { error } = await client()
    .from("favorites")
    .upsert(
      campsiteIds.map((campsiteId) => ({ user_id: userId, campsite_id: campsiteId })),
      { onConflict: "user_id,campsite_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeFavorite(userId: string, campsiteId: string): Promise<void> {
  const { error } = await client().from("favorites").delete().eq("user_id", userId).eq("campsite_id", campsiteId);
  if (error) throw error;
}
