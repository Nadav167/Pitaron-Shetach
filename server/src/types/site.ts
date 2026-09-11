/**
 * Mirrors app/src/types/site.ts. Kept as a separate copy for the skeleton
 * (see the note in the frontend file) — promote both to a shared workspace
 * package once the shape stabilizes.
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
  note?: string;
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
  coordinates: { lat: number; lng: number };
  address?: string;
  pricePerNight: number | null;
  currency: "ILS";
  openingHours: OpeningHours;
  amenities: Amenities;
  photos: string[];
  contact: { phone?: string; website?: string; email?: string };
  rating?: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

/** Shape of a row in the `sites` Postgres table, before mapping to `Site`. */
export type SiteRow = {
  id: string;
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  region: string;
  lat: number;
  lng: number;
  address: string | null;
  price_per_night: number | null;
  opening_hours: OpeningHours;
  amenities: Amenities;
  photos: string[];
  contact_phone: string | null;
  contact_website: string | null;
  contact_email: string | null;
  rating: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};
