import { useEffect, useMemo, useState } from "react";
import type { Campsite } from "@/types/campsite";
import { api } from "@/api/client";
import { campsites as bundledCampsites, generatedAt } from "@/data/campsites";

type UseCampsitesResult = {
  campsites: Campsite[];
  /** Alias kept so older call sites reading `sites` keep working. */
  sites: Campsite[];
  loading: boolean;
  error: string | null;
  /** True while showing the JSON bundled at build time rather than live API data. */
  usingBundledData: boolean;
  /** When the bundled dataset was scraped — surfaced so stale data is visible. */
  dataGeneratedAt: string;
};

/**
 * Campsites come from the bundled dataset first, then upgrade to API data if
 * the backend is configured and reachable.
 *
 * That order is deliberate and the reverse of the usual pattern: this app is
 * used where there is no signal, so it renders instantly from the JSON scraped
 * into the bundle and only swaps in fresher records once the network answers.
 * The user never sees a spinner over an empty list just because they're in a
 * canyon.
 */
export function useCampsites(): UseCampsitesResult {
  const [remote, setRemote] = useState<Campsite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getCampsites();
        if (!cancelled && Array.isArray(data) && data.length > 0) setRemote(data);
      } catch (err) {
        // Not surfaced as a failure: the bundled data is a legitimate answer,
        // not a degraded one. Recorded for the settings/debug screen only.
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load campsites");
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

  const campsites = remote ?? bundledCampsites;

  return useMemo(
    () => ({
      campsites,
      sites: campsites,
      loading: loading && campsites.length === 0,
      error,
      usingBundledData: remote === null,
      dataGeneratedAt: generatedAt,
    }),
    [campsites, loading, error, remote]
  );
}

/** @deprecated Prefer `useCampsites`. */
export const useSites = useCampsites;
