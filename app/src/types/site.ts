/**
 * Core data model for a night parking / camping site.
 *
 * Mirrors the shape returned by the backend API (see server/src/types/site.ts)
 * and the `sites` table defined in supabase/migrations/0001_init.sql.
 *
 * Kept intentionally flat for the skeleton; if the frontend and backend
 * packages need to share this type verbatim later, promote it to a small
 * shared workspace package instead of hand-syncing the two copies.
 */

export type Amenities = {
  water: boolean;
  electricity: boolean;
  toilets: boolean;
  shower: boolean;
  shade: boolean;
  picnicTables: boolean;
  wasteDisposal: boolean;
  fourByFourRequired: boolean;
  cellReception: boolean;
};

export type OpeningHours = {
  /** Free-text fallback, e.g. "Open year-round" or "Apr–Oct only". */
  note?: string;
  /** Structured hours, when known. Omit a day if there's no fixed schedule. */
  days?: Partial<
    Record<
      "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
      { open: string; close: string }
    >
  >;
};

export type SiteTranslations = {
  he: { name: string; description?: string };
  en: { name: string; description?: string };
};

export type Site = {
  id: string;
  translations: SiteTranslations;
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  address?: string;
  /** Price per night in ILS. 0 or null means free. */
  pricePerNight: number | null;
  currency: "ILS";
  openingHours: OpeningHours;
  amenities: Amenities;
  photos: string[];
  contact: {
    phone?: string;
    website?: string;
    email?: string;
  };
  rating?: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export type Locale = "he" | "en";
