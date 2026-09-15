import { useEffect, useState } from "react";
import type { Campsite } from "@/types/campsite";
import { api } from "@/api/client";
import { getCampsiteById } from "@/data/campsites";

type UseCampsiteResult = {
  campsite: Campsite | undefined;
  /** Alias kept so older call sites reading `site` keep working. */
  site: Campsite | undefined;
  loading: boolean;
  error: string | null;
};

/**
 * Same offline-first order as `useCampsites`: resolve from the bundled dataset
 * immediately so the detail screen paints, then replace with API data if the
 * backend answers.
 */
export function useCampsite(id: string | undefined): UseCampsiteResult {
  const bundled = getCampsiteById(id);
  const [remote, setRemote] = useState<Campsite | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getCampsiteById(id as string);
        if (!cancelled && data) setRemote(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load campsite");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const campsite = remote ?? bundled;

  return {
    campsite,
    site: campsite,
    loading: loading && !campsite,
    error: campsite ? null : error,
  };
}

/** @deprecated Prefer `useCampsite`. */
export const useSite = useCampsite;
