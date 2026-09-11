import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

/**
 * In-memory favorites store for the skeleton. Swap the setter for
 * AsyncStorage (or a synced backend endpoint once auth exists) to persist
 * across app restarts.
 */
type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (siteId: string) => void;
  isFavorite: (siteId: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const toggleFavorite = useCallback((siteId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
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
