import type { Campsite, Region } from "@/types/campsite";

export type SortMode = "default" | "priceAsc" | "priceDesc" | "region";

/**
 * The Region type carries 10 fine-grained values (North/Golan/Galilee/Carmel/
 * Center/Jerusalem/Negev/DeadSea/Arava/Eilat) — more detail than the
 * "north / central / south" sort that was asked for, so this buckets them
 * down to three. Golan, Galilee and Carmel read as northern sub-regions;
 * Jerusalem is grouped with Center rather than south; the Negev/Dead
 * Sea/Arava/Eilat corridor is "south".
 */
export const REGION_BUCKET: Record<Region, number> = {
  North: 0,
  Golan: 0,
  Galilee: 0,
  Carmel: 0,
  Center: 1,
  Jerusalem: 1,
  Negev: 2,
  DeadSea: 2,
  Arava: 2,
  Eilat: 2,
};

function priceOf(campsite: Campsite): number {
  if (campsite.pricing.isFree) return 0;
  return campsite.pricing.perNight ?? Number.POSITIVE_INFINITY;
}

/** Returns a new array — never mutates the list passed in. */
export function sortCampsites(list: Campsite[], mode: SortMode): Campsite[] {
  if (mode === "default") return list;
  const sorted = [...list];
  if (mode === "priceAsc") {
    sorted.sort((a, b) => priceOf(a) - priceOf(b));
  } else if (mode === "priceDesc") {
    sorted.sort((a, b) => priceOf(b) - priceOf(a));
  } else if (mode === "region") {
    sorted.sort((a, b) => REGION_BUCKET[a.region] - REGION_BUCKET[b.region]);
  }
  return sorted;
}
