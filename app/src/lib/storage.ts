import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tiny persistent key/value store for user preferences (theme, language,
 * favorites).
 *
 * The providers read their saved value straight into their initial
 * `useState`, so reads have to be synchronous; that way the first render is
 * already correct (no flash of the default theme/language).
 *
 * Web: `localStorage`, which is synchronous already.
 *
 * Native: AsyncStorage is asynchronous, so `hydrateStorage()` loads every
 * key of ours into an in-memory cache once at startup (the root layout
 * waits for it, alongside the fonts, via `useStorageReady`). Reads come from
 * the cache; writes update the cache and are saved to AsyncStorage in the
 * background.
 *
 * Every access is guarded: storage can throw or reject (private mode,
 * blocked site data, quota) and a preference failing to save must never
 * break the app.
 */

const PREFIX = "pitron-shetach:";
const isWeb = Platform.OS === "web";

const nativeCache = new Map<string, string>();
let hydration: Promise<void> | null = null;

function webStorage(): Storage | null {
  if (!isWeb || typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Native: fills the cache from AsyncStorage. Web: nothing to do. Safe to call repeatedly. */
export function hydrateStorage(): Promise<void> {
  if (isWeb) return Promise.resolve();
  hydration ??= (async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
      for (const [key, value] of await AsyncStorage.multiGet(keys)) {
        if (value != null) nativeCache.set(key, value);
      }
    } catch {
      // Start from defaults; see the note above.
    }
  })();
  return hydration;
}

/** True once saved preferences can be read (immediately on web). */
export function useStorageReady(): boolean {
  const [ready, setReady] = useState(isWeb);
  useEffect(() => {
    if (ready) return;
    let mounted = true;
    hydrateStorage().then(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, [ready]);
  return ready;
}

export function loadString(key: string): string | null {
  if (!isWeb) return nativeCache.get(PREFIX + key) ?? null;
  try {
    return webStorage()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function saveString(key: string, value: string): void {
  if (!isWeb) {
    nativeCache.set(PREFIX + key, value);
    AsyncStorage.setItem(PREFIX + key, value).catch(() => {});
    return;
  }
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
