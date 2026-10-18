import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";
import * as favoritesService from "@/services/favorites";

const GUEST_STORAGE_KEY = "favorites";

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (siteId: string) => void;
  isFavorite: (siteId: string) => boolean;
  /** True while a signed-in user's saved list is being loaded. */
  loading: boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

function loadGuestIds(): Set<string> {
  const saved = loadJSON<unknown>(GUEST_STORAGE_KEY);
  return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
}

/**
 * Saved campsites, in one of two places:
 *
 *   Signed out  the device's own list (lib/storage), as before accounts.
 *   Signed in   the user's rows in the `favorites` table, so they follow
 *               the user to any device (services/favorites.ts).
 *
 * On sign-in, whatever was saved on the device as a guest is added to the
 * account and the device list is cleared, so nothing picked before logging
 * in is lost and it isn't left behind for the next person on that device.
 * Signing out shows the (now empty) device list again.
 *
 * Changes while signed in are applied on screen immediately and rolled back
 * if the database write fails.
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status, userId } = useAuth();
  const [guestIds, setGuestIds] = useState<Set<string>>(loadGuestIds);
  const [accountIds, setAccountIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Latest guest list for the sign-in merge, without making the merge
  // effect re-run every time a guest favorite changes.
  const guestIdsRef = useRef(guestIds);
  guestIdsRef.current = guestIds;

  const saveGuestIds = useCallback((next: Set<string>) => {
    setGuestIds(next);
    saveJSON(GUEST_STORAGE_KEY, [...next]);
  }, []);

  useEffect(() => {
    if (!userId) {
      setAccountIds(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const guest = [...guestIdsRef.current];
      try {
        const saved = await favoritesService.fetchFavoriteIds(userId);
        const toAdd = guest.filter((id) => !saved.includes(id));
        await favoritesService.addFavorites(userId, toAdd);
        if (cancelled) return;
        setAccountIds(new Set([...saved, ...toAdd]));
        if (guest.length > 0) saveGuestIds(new Set());
      } catch {
        // Offline or the request failed: show what this device has, and
        // keep it stored so the merge is retried on the next sign-in.
        if (!cancelled) setAccountIds(new Set(guest));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, saveGuestIds]);

  const signedIn = status === "signedIn" && userId !== null;
  const favoriteIds = signedIn ? accountIds : guestIds;

  const toggleFavorite = useCallback(
    (siteId: string) => {
      const adding = !favoriteIds.has(siteId);
      const next = new Set(favoriteIds);
      if (adding) next.add(siteId);
      else next.delete(siteId);

      if (!signedIn || !userId) {
        saveGuestIds(next);
        return;
      }

      setAccountIds(next);
      const write = adding
        ? favoritesService.addFavorites(userId, [siteId])
        : favoritesService.removeFavorite(userId, siteId);
      write.catch(() => {
        // Undo just this change, leaving any other toggles made meanwhile.
        setAccountIds((current) => {
          const reverted = new Set(current);
          if (adding) reverted.delete(siteId);
          else reverted.add(siteId);
          return reverted;
        });
      });
    },
    [favoriteIds, signedIn, userId, saveGuestIds]
  );

  const isFavorite = useCallback((siteId: string) => favoriteIds.has(siteId), [favoriteIds]);

  const value = useMemo(
    () => ({ favoriteIds, toggleFavorite, isFavorite, loading }),
    [favoriteIds, toggleFavorite, isFavorite, loading]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
