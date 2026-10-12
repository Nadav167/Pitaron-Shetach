import { Linking, Platform } from "react-native";
import type { Campsite, Coordinates, NavigationUrls } from "@/types/campsite";

/**
 * Turn-by-turn deep links for Waze and Google Maps.
 *
 * Both apps accept two addressing modes, and we need both because a handful
 * of sites have no coordinates (see `MaybeCoordinates` in types/campsite.ts):
 *
 *   coordinates → waze.com/ul?ll=<lat>,<lng>&navigate=yes
 *                 google.com/maps/dir/?api=1&destination=<lat>,<lng>
 *   name only   → waze.com/ul?q=<name>
 *                 google.com/maps/search/?api=1&query=<name>
 *
 * The `waze.com/ul` universal link is deliberate: on a phone with Waze
 * installed it opens the app, and everywhere else (including web) it falls
 * back to Waze's site rather than failing to resolve a `waze://` scheme.
 * Same reasoning for Google's `?api=1` HTTPS URLs over `geo:`/`comgooglemaps:`.
 */

const WAZE_BASE = "https://waze.com/ul";
const GMAPS_BASE = "https://www.google.com/maps";

export function buildWazeUrl(coordinates: Coordinates | null, fallbackQuery?: string): string {
  if (coordinates) {
    return `${WAZE_BASE}?ll=${coordinates.lat}%2C${coordinates.lng}&navigate=yes&zoom=17`;
  }
  return `${WAZE_BASE}?q=${encodeURIComponent(fallbackQuery ?? "")}&navigate=yes`;
}

export function buildGoogleMapsUrl(coordinates: Coordinates | null, fallbackQuery?: string): string {
  if (coordinates) {
    return `${GMAPS_BASE}/dir/?api=1&destination=${coordinates.lat}%2C${coordinates.lng}&travelmode=driving`;
  }
  return `${GMAPS_BASE}/search/?api=1&query=${encodeURIComponent(fallbackQuery ?? "")}`;
}

export function buildNavigationUrls(
  coordinates: Coordinates | null,
  fallbackQuery?: string
): NavigationUrls {
  return {
    waze: buildWazeUrl(coordinates, fallbackQuery),
    googleMaps: buildGoogleMapsUrl(coordinates, fallbackQuery),
  };
}

/**
 * Prefer the URLs baked in by the scraper, but rebuild from coordinates if a
 * record predates them — so an older campsites.json still navigates.
 */
export function navigationUrlsFor(campsite: Campsite): NavigationUrls {
  if (campsite.navigationUrls?.waze && campsite.navigationUrls?.googleMaps) {
    return campsite.navigationUrls;
  }
  return buildNavigationUrls(campsite.coordinates, campsite.name.he);
}

export type NavigationApp = "waze" | "googleMaps";

/**
 * Opens the link, reporting failure instead of throwing. `canOpenURL` is
 * skipped on web (it resolves false for anything the browser hasn't been
 * told about) and used on native to distinguish "no app for this" from a
 * genuine error.
 */
export async function openNavigation(
  campsite: Campsite,
  app: NavigationApp
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = navigationUrlsFor(campsite)[app];

  try {
    if (Platform.OS !== "web") {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        return { ok: false, reason: `No app available to open ${url}` };
      }
    }
    await Linking.openURL(url);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Failed to open navigation app",
    };
  }
}
