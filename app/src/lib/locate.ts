import { Platform } from "react-native";
import type { Coordinates } from "@/types/campsite";

/**
 * The visitor's current position, for the map's "near me" button.
 *
 * Web only for now: browsers expose `navigator.geolocation`, while React
 * Native's iOS/Android runtime doesn't, and the native route needs the
 * `expo-location` package, which isn't installed yet (new dependency, see
 * docs/HANDOFF.md). Callers check `canLocate` and hide the button where it
 * would do nothing.
 *
 * The browser asks for permission on the first call, so this is only ever
 * called from a tap on the button, never on page load.
 */
export const canLocate: boolean =
  Platform.OS === "web" && typeof navigator !== "undefined" && "geolocation" in navigator;

export type LocateError = "denied" | "unavailable";

export function locate(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!canLocate) {
      reject("unavailable" satisfies LocateError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject((error.code === error.PERMISSION_DENIED ? "denied" : "unavailable") satisfies LocateError),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}
