import { useEffect, useState } from "react";
import { Site } from "@/types/site";
import { api } from "@/api/client";
import { mockSites } from "@/data/mockSites";

type UseSitesResult = {
  sites: Site[];
  loading: boolean;
  error: string | null;
  usingMockData: boolean;
};

/**
 * Fetches sites from the backend API. Falls back to bundled mock data when
 * the API isn't configured/reachable yet, so the UI is demoable before the
 * backend + Supabase are wired up. Remove the fallback once the API is the
 * only source of truth.
 */
export function useSites(): UseSitesResult {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getSites();
        if (!cancelled) {
          setSites(data);
          setUsingMockData(false);
        }
      } catch (err) {
        if (!cancelled) {
          setSites(mockSites);
          setUsingMockData(true);
          setError(err instanceof Error ? err.message : "Failed to load sites");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sites, loading, error, usingMockData };
}
