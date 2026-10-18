import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { loadJSON, saveJSON } from "@/lib/storage";

const STORAGE_KEY = "favorites";

/**
 * Favorites store. Saved locally per device (web: localStorage; native: not
 * yet, see lib/storage). A synced backend endpoint can replace this once
 * accounts exist.
 */
type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (siteId: string) => void;
  isFavorite: (siteId: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    const saved = loadJSON<unknown>(STORAGE_KEY);
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
  });

  const toggleFavorite = useCallback((siteId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      saveJSON(STORAGE_KEY, [...next]);
      return next;
    });
  }, []);

  const isFavorite = useCallback((siteId: string) => favoriteIds.has(siteId), [favoriteIds]);

  const value = useMemo(() => ({ favoriteIds, toggleFavorite, isFavorite }), [favoriteIds, toggleFavorite, isFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
