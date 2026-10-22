import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Amenities, Campsite } from "@/types/campsite";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Icons for the amenities worth showing on a card, in display order. */
const AMENITY_ICONS: Partial<Record<keyof Amenities, IconName>> = {
  water: "water",
  toilets: "toilet",
  shower: "shower-head",
  electricity: "flash",
  shade: "umbrella-beach-outline",
  picnicTables: "table-picnic",
};

export type CardFacts = {
  /** "₪76", "חינם" or "מחיר לא ידוע". */
  price: string;
  /** "כניסה עד 19:00" when the latest arrival time is known, else the
   *  source's free-text hours note, else undefined. */
  hours?: string;
  /** Amenities the source positively confirmed (absent = unknown). */
  amenities: { key: keyof Amenities; icon: IconName; label: string }[];
};

/**
 * The short facts a list card or the map's site card shows, worded the same
 * way everywhere. The price is the bare amount: "ללילה" is implied in a
 * list where every price is per night, and dropping it lets the price share
 * the name's line.
 */
export function cardFacts(campsite: Campsite, t: (path: string) => string): CardFacts {
  const price = campsite.pricing.isFree
    ? t("common.free")
    : campsite.pricing.perNight != null
    ? `₪${campsite.pricing.perNight}`
    : t("common.priceUnknown");

  const { checkIn, note } = campsite.openingHours;
  const hours = checkIn ? `${t("site.checkIn")} ${checkIn}` : note || undefined;

  const amenities = (Object.keys(AMENITY_ICONS) as (keyof Amenities)[])
    .filter((key) => campsite.amenities[key] === true)
    .map((key) => ({ key, icon: AMENITY_ICONS[key]!, label: t(`site.amenity.${key}`) }));

  return { price, hours, amenities };
}
