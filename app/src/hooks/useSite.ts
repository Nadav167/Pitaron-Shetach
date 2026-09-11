import { useEffect, useState } from "react";
import { Site } from "@/types/site";
import { api } from "@/api/client";
import { mockSites } from "@/data/mockSites";

export function useSite(id: string | undefined) {
  const [site, setSite] = useState<Site | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getSiteById(id as string);
        if (!cancelled) setSite(data);
      } catch (err) {
        if (!cancelled) {
          const fallback = mockSites.find((s) => s.id === id);
          setSite(fallback);
          setError(err instanceof Error ? err.message : "Failed to load site");
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

  return { site, loading, error };
}
