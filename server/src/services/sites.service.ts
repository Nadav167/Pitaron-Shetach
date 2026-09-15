import { getSupabase } from "../db/supabase";
import { HttpError } from "../middleware/errorHandler";
import { Campsite, Region, SiteRow } from "../types/site";

/**
 * Business logic for campsites, kept separate from routing/controllers per the
 * project guidelines in CLAUDE.md. All Supabase/Postgres access should go
 * through this layer, not directly from controllers.
 */

const REGIONS: Region[] = [
  "North",
  "Golan",
  "Galilee",
  "Carmel",
  "Center",
  "Jerusalem",
  "Negev",
  "DeadSea",
  "Arava",
  "Eilat",
];

function toRegion(value: string): Region {
  return (REGIONS as string[]).includes(value) ? (value as Region) : "North";
}

/**
 * Navigation deep links are derived here rather than stored, so a row whose
 * coordinates are corrected doesn't also need its URLs rewritten. Mirrors
 * app/src/lib/navigation.ts — keep the URL shapes in sync.
 */
function buildNavigationUrls(lat: number | null, lng: number | null, fallbackQuery: string) {
  if (lat !== null && lng !== null) {
    return {
      waze: `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=17`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=driving`,
    };
  }
  const q = encodeURIComponent(fallbackQuery);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

function mapRowToCampsite(row: SiteRow): Campsite {
  const campsite: Campsite = {
    id: row.id,
    name: { he: row.name_he, en: row.name_en },
    coordinates: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    isOfficial: row.is_official,
    region: toRegion(row.region),
    pricing: {
      perNight: row.price_per_night,
      currency: "ILS",
      isFree: row.price_is_free,
      ...(row.price_note ? { note: row.price_note } : {}),
    },
    openingHours: row.opening_hours ?? {},
    navigationUrls: buildNavigationUrls(row.lat, row.lng, row.name_he || row.name_en),
    amenities: row.amenities ?? {},
    photos: row.photos ?? [],
    contact: {
      phone: row.contact_phone ?? undefined,
      website: row.contact_website ?? undefined,
      email: row.contact_email ?? undefined,
    },
    source: {
      name: row.source ?? "unknown",
      url: row.source_url ?? undefined,
      coordsSource: row.coords_source ?? undefined,
      needsReview: row.needs_review || row.lat === null,
    },
    updatedAt: row.updated_at,
  };

  if (row.description_he || row.description_en) {
    campsite.description = {};
    if (row.description_he) campsite.description.he = row.description_he;
    if (row.description_en) campsite.description.en = row.description_en;
  }
  if (row.address) campsite.address = row.address;
  if (row.rating !== null) campsite.rating = row.rating;

  return campsite;
}

export async function listSites(): Promise<Campsite[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    // Official sites first — they're the ones with reliable prices and hours.
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to list sites: ${error.message}`);
  }

  return (data as SiteRow[]).map(mapRowToCampsite);
}

export async function getSiteById(id: string): Promise<Campsite> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to load site ${id}: ${error.message}`);
  }
  if (!data) {
    throw new HttpError(404, `Site ${id} not found`);
  }

  return mapRowToCampsite(data as SiteRow);
}

/**
 * Placeholder for a proximity search ("sites within N km of me"). The
 * migration enables PostGIS and adds a generated `location geography`
 * column precisely so this can be implemented with an efficient index-
 * backed query instead of scanning every row and computing distance in
 * JS. Note that rows with null lat/lng have a null `location` and are
 * excluded by ST_DWithin automatically, which is the desired behaviour.
 * Suggested implementation once needed:
 *
 *   create or replace function sites_within_radius(lat float, lng float, radius_km float)
 *   returns setof sites language sql stable as $$
 *     select * from sites
 *     where ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
 *     order by location <-> ST_MakePoint(lng, lat)::geography;
 *   $$;
 *
 * ...then call it here via `supabase.rpc('sites_within_radius', { lat, lng, radius_km })`.
 */
export async function findSitesNearby(_lat: number, _lng: number, _radiusKm: number): Promise<Campsite[]> {
  throw new HttpError(501, "findSitesNearby is not implemented yet — see the docstring in sites.service.ts");
}
