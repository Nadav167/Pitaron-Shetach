/**
 * Mirrors app/src/types/campsite.ts. Kept as a separate copy for now (see the
 * note in the frontend file) — promote both to a shared workspace package once
 * the shape stabilizes.
 *
 * The model is unified across both data sources: official Nature and Parks
 * Authority night camping grounds and non-official community listings share
 * one shape, distinguished by `isOfficial`.
 */

export type Locale = "he" | "en";

export type LocalizedText = {
  he: string;
  en: string;
};

export type Region =
  | "North"
  | "Golan"
  | "Galilee"
  | "Carmel"
  | "Center"
  | "Jerusalem"
  | "Negev"
  | "DeadSea"
  | "Arava"
  | "Eilat";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Pricing = {
  perNight: number | null;
  currency: "ILS";
  isFree: boolean;
  note?: string;
};

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type OpeningHours = {
  note?: string;
  checkIn?: string;
  checkOut?: string;
  days?: Partial<Record<Weekday, { open: string; close: string }>>;
};

export type NavigationUrls = {
  waze: string;
  googleMaps: string;
};

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

export type KnownAmenities = Partial<Amenities>;

export type Photo = {
  url: string;
  isPlaceholder?: boolean;
  credit?: string;
};

export type Contact = {
  phone?: string;
  website?: string;
  email?: string;
};

export type CampsiteSource = {
  name: string;
  url?: string;
  coordsSource?: string;
  scrapedAt?: string;
  needsReview?: boolean;
};

export type Campsite = {
  id: string;
  name: LocalizedText;
  description?: Partial<LocalizedText>;
  /** Null when no coordinate could be verified — see app/src/types/campsite.ts. */
  coordinates: Coordinates | null;
  isOfficial: boolean;
  region: Region;
  address?: string;
  pricing: Pricing;
  openingHours: OpeningHours;
  navigationUrls: NavigationUrls;
  amenities: KnownAmenities;
  photos: Photo[];
  contact: Contact;
  rating?: number;
  source: CampsiteSource;
  updatedAt: string;
};

/** @deprecated Use `Campsite`. */
export type Site = Campsite;

/**
 * Raw row shape of the `sites` table.
 * See supabase/migrations/0001_init.sql and 0002_unified_campsite_model.sql.
 */
export type SiteRow = {
  id: string;
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  region: string;
  /** Nullable since 0002: a site with no verified coordinate is still listed. */
  lat: number | null;
  lng: number | null;
  address: string | null;
  price_per_night: number | null;
  price_is_free: boolean;
  price_note: string | null;
  is_official: boolean;
  opening_hours: OpeningHours;
  amenities: KnownAmenities;
  photos: Photo[];
  contact_phone: string | null;
  contact_website: string | null;
  contact_email: string | null;
  rating: number | null;
  source: string | null;
  source_url: string | null;
  coords_source: string | null;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
};

/** @deprecated Use `SiteRow`. */
export type CampsiteRow = SiteRow;
