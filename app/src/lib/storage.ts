import { Platform } from "react-native";

/**
 * Tiny persistent key/value store for user preferences (theme, language,
 * favorites).
 *
 * Web: `localStorage`, which is synchronous, so a provider can read its
 * saved value straight into its initial `useState` and the first render is
 * already correct (no flash of the default theme/language).
 *
 * Native: not persisted yet. That needs @react-native-async-storage/async-storage,
 * a new dependency waiting on approval, so for now reads return null and
 * writes are dropped, i.e. native behaves exactly as it did before.
 *
 * Every access is wrapped in try/catch: storage can throw (private mode,
 * blocked site data, quota) and a preference failing to save must never
 * break the app.
 */

const PREFIX = "pitron-shetach:";

function webStorage(): Storage | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadString(key: string): string | null {
  try {
    return webStorage()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function saveString(key: string, value: string): void {
  try {
    webStorage()?.setItem(PREFIX + key, value);
  } catch {
    // Ignore: see the note above.
  }
}

export function loadJSON<T>(key: string): T | null {
  const raw = loadString(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  saveString(key, JSON.stringify(value));
}
