import dataset from "../../assets/data/campsites.json";
import { isNightCamp, type Campsite, type CampsiteDataset } from "../../src/types/campsite";

/**
 * The agent's view of the app's campsite list: the same JSON the app ships
 * (assets/data/campsites.json), so the agent can only plan nights at sites
 * the app actually shows.
 *
 * A compact one-line-per-site index goes straight into the system prompt
 * rather than behind a search tool: the model sees every option at once,
 * and the index is part of the cached prompt prefix. Since the OpenStreetMap
 * and tiuli imports (Oct 2026) that is ~405 sites, ~30k tokens: still cheap as a cache
 * read, but if the list grows much further, move it behind a search tool.
 * Full details for one site come from get_campsite_details.
 */

const campsites = (dataset as CampsiteDataset).campsites;

const AMENITY_LABELS: [keyof Campsite["amenities"], string][] = [
  ["water", "water"],
  ["toilets", "toilets"],
  ["shower", "shower"],
  ["electricity", "electricity"],
  ["shade", "shade"],
  ["picnicTables", "tables"],
  ["cellReception", "reception"],
  ["fourByFourRequired", "4x4-only"],
];

function priceLabel(site: Campsite): string {
  if (site.pricing.isFree) return "free";
  if (site.pricing.perNight != null) return `₪${site.pricing.perNight}/night`;
  return "price unknown";
}

/** One line per site: id | names | region | coordinates | price | known amenities. */
export function campsiteIndex(): string {
  return campsites
    .map((site) => {
      const coords = site.coordinates
        ? `${site.coordinates.lat.toFixed(4)},${site.coordinates.lng.toFixed(4)}`
        : "no coordinates";
      const amenities = AMENITY_LABELS.filter(([key]) => site.amenities[key] === true).map(([, label]) => label);
      return [
        site.id,
        `${site.name.he} / ${site.name.en}`,
        site.region,
        coords,
        priceLabel(site),
        [site.isOfficial ? "official (INPA)" : "unofficial listing", isNightCamp(site) ? "night camp" : "campground"].join(", "),
        amenities.length ? amenities.join(",") : "amenities unknown",
      ].join(" | ");
    })
    .join("\n");
}

export function findCampsite(id: string): Campsite | undefined {
  return campsites.find((site) => site.id === id);
}

/** Everything the agent may want to tell a user about one site. */
export function campsiteDetails(id: string) {
  const site = findCampsite(id);
  if (!site) return null;
  return {
    id: site.id,
    name: site.name,
    region: site.region,
    isOfficial: site.isOfficial,
    coordinates: site.coordinates,
    description: site.description ?? null,
    address: site.address ?? null,
    pricing: site.pricing,
    openingHours: site.openingHours,
    // Absent keys mean "unknown", not "no".
    amenitiesConfirmed: site.amenities,
    contact: site.contact,
    needsReview: site.source.needsReview ?? false,
    appUrl: `https://pitaron-shetach.vercel.app/site/${site.id}`,
  };
}
