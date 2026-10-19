import placesData from "../data/nearbyPlaces.json";

/**
 * Places near the app's campsites (restaurants, attractions, springs...),
 * from OpenStreetMap.
 *
 * Read from a pre-built file, app/backend/data/nearbyPlaces.json, made by
 * scripts/buildNearbyPlaces.js from Geofabrik's OpenStreetMap extract (the
 * script's header explains why not a live API). The agent only plans
 * around campsites known in advance, so a lookup is a filter over local
 * data: instant, free, and never down.
 *
 * Data is © OpenStreetMap contributors (ODbL); the itinerary page and PDF
 * carry that credit.
 */

// Keep in sync with CATEGORIES in scripts/buildNearbyPlaces.js.
export const PLACE_CATEGORIES = [
  "restaurant",
  "cafe",
  "attraction",
  "viewpoint",
  "nature",
  "beach",
  "museum",
  "historic",
  "picnic",
  "supermarket",
  "fuel",
  "gear",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export type NearbyPlace = {
  /** As mapped, usually Hebrew. */
  name: string;
  category: PlaceCategory;
  /** OSM place class, e.g. "restaurant", "spring", "archaeological". */
  type: string;
  /** Straight-line km from the campsite. */
  distanceKm: number;
  lat: number;
  lng: number;
};

type PlacesFile = {
  generatedAt: string;
  source: string;
  radiusKm: number;
  byCampsite: Record<string, NearbyPlace[]>;
};

const data = placesData as unknown as PlacesFile;
const MAX_PER_CATEGORY = 8;

export type NearbyPlacesResult =
  | {
      ok: true;
      source: string;
      dataDate: string;
      places: Partial<Record<PlaceCategory, NearbyPlace[]>>;
    }
  | { ok: false; error: string };

export function findNearbyPlaces(campsiteId: string, categories: string[], maxKm: number): NearbyPlacesResult {
  const all = data.byCampsite[campsiteId];
  if (!all) {
    return {
      ok: false,
      error: `No places data for "${campsiteId}" (it may have no coordinates). Plan with well-known landmarks only and tell the user to look up food nearby.`,
    };
  }
  const wanted = new Set(categories.filter((c): c is PlaceCategory => (PLACE_CATEGORIES as readonly string[]).includes(c)));
  const radius = Math.min(Math.max(maxKm, 1), data.radiusKm);

  const places: Partial<Record<PlaceCategory, NearbyPlace[]>> = {};
  // The file is sorted by distance within each category.
  for (const place of all) {
    if (!wanted.has(place.category) || place.distanceKm > radius) continue;
    const list = (places[place.category] ??= []);
    if (list.length < MAX_PER_CATEGORY) list.push(place);
  }
  return { ok: true, source: "OpenStreetMap", dataDate: data.generatedAt.slice(0, 10), places };
}
