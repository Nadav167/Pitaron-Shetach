import { getSupabase } from "../db/supabase";
import { HttpError } from "../middleware/errorHandler";
import { Site, SiteRow } from "../types/site";

/**
 * Business logic for sites, kept separate from routing/controllers per the
 * project guidelines in CLAUDE.md. All Supabase/Postgres access should go
 * through this layer, not directly from controllers.
 */

function mapRowToSite(row: SiteRow): Site {
  return {
    id: row.id,
    translations: {
      he: { name: row.name_he, description: row.description_he ?? undefined },
      en: { name: row.name_en, description: row.description_en ?? undefined },
    },
    region: row.region,
    coordinates: { lat: row.lat, lng: row.lng },
    address: row.address ?? undefined,
    pricePerNight: row.price_per_night,
    currency: "ILS",
    openingHours: row.opening_hours,
    amenities: row.amenities,
    photos: row.photos ?? [],
    contact: {
      phone: row.contact_phone ?? undefined,
      website: row.contact_website ?? undefined,
      email: row.contact_email ?? undefined,
    },
    rating: row.rating ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSites(): Promise<Site[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("sites").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to list sites: ${error.message}`);
  }

  return (data as SiteRow[]).map(mapRowToSite);
}

export async function getSiteById(id: string): Promise<Site> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("sites").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to load site ${id}: ${error.message}`);
  }
  if (!data) {
    throw new HttpError(404, `Site ${id} not found`);
  }

  return mapRowToSite(data as SiteRow);
}

/**
 * Placeholder for a proximity search ("sites within N km of me"). The
 * migration enables PostGIS and adds a generated `location geography`
 * column precisely so this can be implemented with an efficient index-
 * backed query instead of scanning every row and computing distance in
 * JS. Suggested implementation once needed:
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
export async function findSitesNearby(_lat: number, _lng: number, _radiusKm: number): Promise<Site[]> {
  throw new HttpError(501, "findSitesNearby is not implemented yet — see the docstring in sites.service.ts");
}
