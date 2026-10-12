import type { Campsite, CampsiteDataset } from "@/types/campsite";
import dataset from "../../assets/data/campsites.json";

/**
 * The bundled dataset produced by scripts/scrapeCampsites.js.
 *
 * Imported directly rather than fetched: it's a few dozen records, it has to
 * work offline (people look these up with no signal, in a desert, at night),
 * and Metro bundles JSON natively. When the backend goes live this becomes the
 * offline fallback rather than the primary source — see hooks/useSites.ts.
 *
 * The double assertion is needed because TypeScript infers JSON string fields
 * as `string`, which doesn't narrow to the `Region` / `"ILS"` unions on its
 * own. The scraper is what guarantees the values are valid — see
 * `normalizeRegion` there — so this is the one place that trust is asserted.
 */
const typed = dataset as unknown as CampsiteDataset;

export const campsiteDataset: CampsiteDataset = typed;
export const campsites: Campsite[] = typed.campsites;

export const generatedAt = typed.generatedAt;

/** Sites that can be pinned. A record with no verified coordinates is listed but not mapped. */
export const mappableCampsites: Campsite[] = campsites.filter((c) => c.coordinates !== null);

export function getCampsiteById(id: string | undefined): Campsite | undefined {
  if (!id) return undefined;
  return campsites.find((campsite) => campsite.id === id);
}
