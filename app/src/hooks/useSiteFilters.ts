import { useCallback, useMemo, useState } from "react";
import { isNightCamp, localized, type Campsite, type Region } from "@/types/campsite";
import type { City } from "@/data/cities";
import { findCityInQuery, searchCampsites } from "@/lib/search";
import { sortCampsites, type SortMode } from "@/lib/sort";
import { distanceKm } from "@/lib/geo";
import { useLocale } from "@/context/LocaleContext";

export type SourceFilter = "all" | "official" | "unofficial";

/** The steps of the radius scale shown once a town is recognised, in km. */
export const RADIUS_OPTIONS_KM = [10, 25, 50, 100];
const DEFAULT_RADIUS_KM = 25;

/** Regions in the order the filter sheet lists them: north to south. */
export const REGIONS_NORTH_TO_SOUTH: Region[] = [
  "Golan",
  "Galilee",
  "North",
  "Carmel",
  "Center",
  "Jerusalem",
  "DeadSea",
  "Negev",
  "Arava",
  "Eilat",
];

export type SiteFilters = {
  query: string;
  setQuery: (query: string) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (filter: SourceFilter) => void;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  /** The town named in the query, if any — switches on the radius search. */
  city: City | null;
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  /** Only sites the source says are free. */
  freeOnly: boolean;
  setFreeOnly: (freeOnly: boolean) => void;
  /** Empty = every region. */
  regions: ReadonlySet<Region>;
  toggleRegion: (region: Region) => void;
  /** How many of the filter sheet's settings differ from the defaults
   *  (sort, free only, each region); shown as a badge on its button. */
  sheetFilterCount: number;
  /** Puts the filter sheet's settings back to their defaults. */
  resetSheetFilters: () => void;
  /** Straight-line km from `city` to a site; undefined when there is no
   *  town in the query or the site has no verified coordinates. */
  distanceFor: (campsite: Campsite) => number | undefined;
  /** `campsites` after the source filter, the search and the sort. */
  visible: Campsite[];
};

/**
 * The filter-chip / search / sort state shared by every screen that lists
 * campsites (Home, Favorites), so they behave identically. Render the
 * controls with `<SiteFilterBar filters={...} />`.
 *
 * When the query names a town, the result is the sites within `radiusKm` of
 * it, nearest first, joined with the sites whose own text mentions the town.
 * The text matches are kept because a site without verified coordinates
 * can't be measured — "קמפינג על הים בנהריה" has no pin, but it must still
 * come up for "נהריה". Those unmeasurable matches are listed first.
 */
export function useSiteFilters(campsites: Campsite[]): SiteFilters {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [freeOnly, setFreeOnly] = useState(false);
  const [regions, setRegions] = useState<ReadonlySet<Region>>(() => new Set());

  const toggleRegion = useCallback((region: Region) => {
    setRegions((current) => {
      const next = new Set(current);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }, []);

  const resetSheetFilters = useCallback(() => {
    setSortMode("default");
    setFreeOnly(false);
    setRegions(new Set());
  }, []);

  const sheetFilterCount = (sortMode === "default" ? 0 : 1) + (freeOnly ? 1 : 0) + regions.size;

  const city = useMemo(() => findCityInQuery(query), [query]);

  const distances = useMemo(() => {
    const byId = new Map<string, number>();
    if (!city) return byId;
    for (const campsite of campsites) {
      if (campsite.coordinates) byId.set(campsite.id, distanceKm(city, campsite.coordinates));
    }
    return byId;
  }, [campsites, city]);

  const distanceFor = useCallback((campsite: Campsite) => distances.get(campsite.id), [distances]);

  const visible = useMemo(() => {
    let list = campsites;
    if (sourceFilter === "official") list = list.filter(isNightCamp);
    else if (sourceFilter === "unofficial") list = list.filter((c) => !isNightCamp(c));
    if (freeOnly) list = list.filter((c) => c.pricing.isFree);
    if (regions.size > 0) list = list.filter((c) => regions.has(c.region));

    if (!city) return sortCampsites(searchCampsites(list, query), sortMode);

    const textMatches = new Set(searchCampsites(list, query, { fuzzy: false }));
    const unmeasured = list.filter((c) => textMatches.has(c) && !distances.has(c.id));
    const measured = list
      .filter((c) => {
        const km = distances.get(c.id);
        return km !== undefined && (km <= radiusKm || textMatches.has(c));
      })
      .sort((a, b) => distances.get(a.id)! - distances.get(b.id)!);
    return sortCampsites([...unmeasured, ...measured], sortMode);
  }, [campsites, sourceFilter, freeOnly, regions, query, sortMode, city, distances, radiusKm]);

  return {
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    sortMode,
    setSortMode,
    city,
    radiusKm,
    setRadiusKm,
    freeOnly,
    setFreeOnly,
    regions,
    toggleRegion,
    sheetFilterCount,
    resetSheetFilters,
    distanceFor,
    visible,
  };
}

/**
 * Builds the "12 ק"מ מחיפה" line shown on each card during a town search.
 * Returns undefined when no town is being searched, so the list can be
 * handed the result as-is.
 */
export function useDistanceNote(filters: SiteFilters): ((campsite: Campsite) => string | undefined) | undefined {
  const { t, locale } = useLocale();
  const { city, distanceFor } = filters;

  return useMemo(() => {
    if (!city) return undefined;
    const cityName = localized(city.name, locale);
    return (campsite: Campsite) => {
      const km = distanceFor(campsite);
      if (km === undefined) return undefined;
      return t("site.distanceFrom")
        .replace("{km}", String(Math.max(1, Math.round(km))))
        .replace("{city}", cityName);
    };
  }, [city, distanceFor, locale, t]);
}
