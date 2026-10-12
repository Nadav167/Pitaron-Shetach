/**
 * Unified data model for every night parking / camping site in the app.
 *
 * One shape covers both data sources:
 *   - Official sites  (isOfficial: true)  — Israel Nature and Parks Authority
 *                                           night camping grounds (חניוני לילה),
 *                                           scraped from parks.org.il.
 *   - Non-official    (isOfficial: false) — community / private campsites,
 *                                           scraped from gocamping.co.il.
 *
 * The distinction matters to the user, not just to us: official sites have
 * published prices, gate hours and a booking system behind them, while
 * non-official listings are third-party descriptions that drift out of date.
 * The UI surfaces that difference (see `UnofficialNotice`), so `isOfficial`
 * is required on every record rather than optional-with-a-default.
 *
 * Records are produced by scripts/scrapeCampsites.js and shipped as
 * app/assets/data/campsites.json.
 */

export type Locale = "he" | "en";

/** Hebrew is the primary language; English is the toggle. Both required. */
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

/**
 * Nullable on purpose. Neither source publishes coordinates directly
 * (parks.org.il prints "כתבו בוויז: <name>" instead of a pin; gocamping
 * embeds a name-query Google Maps iframe), so the scraper recovers them
 * from secondary sources and a few sites come back without any.
 *
 * A site with no coordinates is still worth listing — it just can't be
 * pinned on the map, and navigation falls back to a name search.
 * Fabricating a plausible-looking coordinate would be worse than null:
 * this app sends people into deserts at night.
 */
export type MaybeCoordinates = Coordinates | null;

export type Pricing = {
  /** Price per night in ILS for one adult pitching their own tent. null = unknown. */
  perNight: number | null;
  currency: "ILS";
  /** True only when the source explicitly says the site is free. */
  isFree: boolean;
  /** Free-text caveat, e.g. "child/soldier rates differ, bungalows priced separately". */
  note?: string;
};

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type OpeningHours = {
  /** Free-text fallback — what the sources actually publish, usually in Hebrew. */
  note?: string;
  /** Latest arrival time at the gate, e.g. "19:00". Official sites enforce this. */
  checkIn?: string;
  /** Vacate-by time, e.g. "12:00". */
  checkOut?: string;
  /** Structured hours where known. Omit a day that has no fixed schedule. */
  days?: Partial<Record<Weekday, { open: string; close: string }>>;
};

/**
 * Deep links handed straight to `Linking.openURL`. Always populated:
 * `src/lib/navigation.ts` builds coordinate links when coordinates exist
 * and name-search links when they don't, so the buttons never dead-end.
 */
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

/**
 * Partial, not full: an absent key means "we don't know", which is different
 * from `false` ("confirmed absent"). Scraped records start mostly empty and
 * fill in as the scraper learns more endpoints.
 */
export type KnownAmenities = Partial<Amenities>;

export type Photo = {
  url: string;
  /**
   * True when the source served a generic stock image rather than a photo of
   * this actual site (gocamping labels these "תמונה להמחשה"). The UI dims
   * these and never presents one as documentation of the place.
   */
  isPlaceholder?: boolean;
  credit?: string;
};

export type Contact = {
  phone?: string;
  website?: string;
  email?: string;
};

/** Provenance, so a questionable pin can be traced back without re-scraping. */
export type CampsiteSource = {
  /** Host the record came from, e.g. "parks.org.il". */
  name: string;
  /** The specific page scraped. */
  url?: string;
  /** Where the coordinates came from — often a different site than `url`. */
  coordsSource?: string;
  /** ISO timestamp of the scrape run that produced this record. */
  scrapedAt?: string;
  /** Set when sources disagree or a value needs a human eyeball before trusting. */
  needsReview?: boolean;
};

export type Campsite = {
  id: string;
  name: LocalizedText;
  description?: Partial<LocalizedText>;
  coordinates: MaybeCoordinates;
  /** Official = Nature and Parks Authority night camping ground. */
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

/** Shape of app/assets/data/campsites.json. */
export type CampsiteDataset = {
  generatedAt: string;
  sources: { name: string; url: string; isOfficial: boolean; count: number }[];
  campsites: Campsite[];
};

export const REGIONS: Region[] = [
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

/** Reads the right language with a Hebrew fallback, since Hebrew is primary. */
export function localized(text: LocalizedText | Partial<LocalizedText> | undefined, locale: Locale): string {
  if (!text) return "";
  return text[locale] ?? text.he ?? text.en ?? "";
}

export function hasCoordinates(campsite: Campsite): campsite is Campsite & { coordinates: Coordinates } {
  return campsite.coordinates !== null;
}
