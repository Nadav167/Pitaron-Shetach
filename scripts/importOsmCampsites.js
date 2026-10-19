#!/usr/bin/env node
/**
 * importOsmCampsites.js — adds every campsite and night camp that
 * OpenStreetMap knows of in Israel to app/assets/data/campsites.json.
 *
 * ---------------------------------------------------------------------------
 * WHY OPENSTREETMAP
 *
 * The two scraped directories (parks.org.il, gocamping.co.il) cover a few
 * dozen sites between them and neither publishes coordinates. OSM has every
 * tourism=camp_site / tourism=caravan_site that mappers have drawn: the
 * Nature and Parks Authority night camps, KKL's free forest camps, desert
 * night camps, private campgrounds — about 600 in the area the map shows,
 * each with a real position, and often a Hebrew + English name, fee, water,
 * toilets and a Wikimedia Commons photo.
 *
 * WHAT IT DOES
 *   1. Loads the campsites (and town names, for naming unnamed sites) from
 *      Overpass, or from saved Overpass JSON (--campsites= / --places=).
 *   2. Keeps the points inside the map window and outside the areas the map
 *      erases (app/assets/data/mapMask.json: neighbouring countries, Gaza),
 *      so "Israel" means exactly what the map shows: Israel, the Golan and
 *      the West Bank (Nadav, 2026-10-13).
 *   3. Merges duplicates (a site drawn as both a point and an outline).
 *   4. Skips anything within DUPLICATE_KM of a site already in the dataset:
 *      the existing records are hand-checked and keep their ids, because
 *      favorites and saved itineraries point at those ids.
 *   5. Photos: the site's own OSM image / wikimedia_commons tags first;
 *      otherwise a Wikimedia Commons photo taken within PHOTO_RADIUS_M whose
 *      title names the site or says it is a campsite (a nearby photo of
 *      anything else is not a photo of the site, so it isn't used).
 *   6. Writes the merged dataset. Existing records are not modified.
 *
 * Ids are `osm-<type>-<osm id>` so that re-running keeps every id stable.
 * English names come from name:en, else from scripts/data/osmNameTranslations.json
 * (hand translations of the Hebrew-only names), else "Campsite near <town>".
 *
 * USAGE
 *   node scripts/importOsmCampsites.js [--campsites=overpass.json] [--places=places.json]
 *                                      [--no-photos] [--refresh-photos] [--dry-run]
 *   Then rebuild the agent's nearby places: node scripts/buildNearbyPlaces.js --shp=<dir>
 *
 * Data © OpenStreetMap contributors (ODbL); photos from Wikimedia Commons
 * under their own free licences, credited on each record.
 * ---------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CAMPSITES = path.join(ROOT, "app/assets/data/campsites.json");
const MASK = path.join(ROOT, "app/assets/data/mapMask.json");
const TRANSLATIONS = path.join(__dirname, "data/osmNameTranslations.json");

const OVERPASS_MIRRORS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const USER_AGENT = "PitaronShetach/1.0 (campsite import; github.com/Nadav167/Pitaron-Shetach)";

/** An OSM site this close to an existing record is taken to be the same site. */
const DUPLICATE_KM = 0.5;
/** ...and this close, if the names also share a word. */
const DUPLICATE_NAMED_KM = 2;
const PHOTO_RADIUS_M = 300;
const PHOTO_WIDTH = 960;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  })
);

// --- Geometry -----------------------------------------------------------------

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Ray casting; mapMask rings are [lat, lng] pairs. */
function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function makeIsraelTest() {
  const mask = JSON.parse(fs.readFileSync(MASK, "utf8"));
  const w = mask.window;
  return (point) => {
    if (point.lat < w.south || point.lat > w.north || point.lng < w.west || point.lng > w.east) return false;
    // An area may be several rings (islands, enclaves): inside an odd number = erased.
    return !mask.areas.some((area) => area.rings.filter((ring) => inRing(point, ring)).length % 2 === 1);
  };
}

/**
 * Region by position. The app's regions are tourist regions, not districts,
 * so these are hand-drawn boxes checked against the existing records'
 * regions; a site near a boundary may land in the neighbouring region,
 * which only affects the "north to south" sort and region search.
 */
function regionFor({ lat, lng }) {
  if (lat < 29.75) return "Eilat";
  if (lat < 30.95) return lng >= 35.05 ? "Arava" : "Negev";
  if (lat < 31.95 && lng >= 35.3) return "DeadSea";
  if (lat < 31.42) return "Negev";
  if (lat < 31.95 && lng >= 34.95) return "Jerusalem";
  if (lng >= 35.62 && lat >= 32.68) return "Golan";
  // Kinneret shore, Jordan / Beit She'an / Jezreel valleys.
  if (lat >= 32.68 && lat < 32.92 && lng >= 35.5) return "North";
  if (lat >= 32.3 && lat < 32.68 && lng >= 35.15) return "North";
  if (lat >= 32.45 && lat < 32.85 && lng < 35.15 && lng >= 34.88) return "Carmel";
  if (lat >= 32.68) return "Galilee";
  return "Center";
}

// --- Overpass -------------------------------------------------------------------

async function overpass(query) {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`  ${mirror}: ${error.message}`);
    }
  }
  throw new Error("Every Overpass mirror failed; save the query output by hand and pass it with --campsites= / --places=");
}

const BBOX = "29.4,33.9,33.6,36.2";

async function loadJson(arg, query) {
  if (typeof arg === "string") return JSON.parse(fs.readFileSync(arg, "utf8")).elements;
  return (await overpass(query)).elements;
}

// --- Names ----------------------------------------------------------------------

const HEBREW = /[֐-׿]/;
const STOP_WORDS = new Set(
  "חניון לילה קמפינג אתר מחנאות חוף יער גן לאומי שמורת טבע של the camp camping campsite campground site night park beach forest national reserve and near ליד"
    .split(" ")
);

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function sharesWord(a, b) {
  const set = new Set(words(a));
  return words(b).some((word) => set.has(word));
}

function nearestPlace(point, places) {
  let best = null;
  for (const place of places) {
    const km = distanceKm(point, place);
    if (!best || km < best.km) best = { ...place, km };
  }
  return best;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Filters out mistagged points. About a third of the camp_site points in
 * the West Bank are homes, shops and halls ("منزل الحاج ...", "Home",
 * "Raged Rageb Home") saved by a mapping app that tags a saved place as a
 * campsite. What is kept:
 *   - any site with a Hebrew name;
 *   - a Latin name that says what it is (camp, beach, village, parking...);
 *   - an unnamed site whose nearest town is named in Hebrew first (so not in
 *     the middle of a Palestinian town, where the mistagged points are).
 * Arabic-only names are dropped: in this data they were all such points.
 */
const LATIN_CAMP_WORD = /camp|beach|village|oasis|desert|tent|parking|caravan|lodge|khan|chan|farm|ranch|forest|nature|eco/i;

function looksLikeCampsite(tags, point, places) {
  const names = [tags.name, tags["name:he"], tags["name:en"]].filter(Boolean).join(" ");
  if (!names) return Boolean(nearestPlace(point, places)?.hebrewPrimary);
  if (HEBREW.test(names)) return true;
  if (/[؀-ۿ]/.test(names) && !tags["name:en"]) return false;
  return LATIN_CAMP_WORD.test(names) && !/\bhome\b|house/i.test(names);
}

// --- Mapping one OSM element to a Campsite record --------------------------------

function yesNo(value) {
  if (value === undefined) return undefined;
  if (/^(no|none)$/i.test(value)) return false;
  return true; // yes, hot, cold, customers, seasonal, ...
}

function osmAmenities(tags) {
  const amenities = {};
  const set = (key, value) => {
    if (value !== undefined) amenities[key] = value;
  };
  set("water", yesNo(tags.drinking_water ?? tags.water_point));
  set("toilets", yesNo(tags.toilets));
  set("shower", yesNo(tags.shower));
  set("electricity", yesNo(tags.power_supply));
  set("picnicTables", yesNo(tags.picnic_table));
  set("shade", yesNo(tags.shelter ?? tags.covered));
  set("wasteDisposal", yesNo(tags.waste_disposal ?? tags["sanitary_dump_station"]));
  if (tags["4wd_only"] !== undefined) amenities.fourByFourRequired = yesNo(tags["4wd_only"]);
  return amenities;
}

/** Commons file name → a thumbnail URL on upload.wikimedia.org (resolved later). */
function commonsFileName(value) {
  const match =
    /^(?:File|Image|קובץ):(.+)$/i.exec(value.trim()) ||
    /commons\.wikimedia\.org\/wiki\/(?:File|Image):([^?#]+)/i.exec(value) ||
    /upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i.exec(value);
  return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : null;
}

function photoCandidates(tags) {
  const values = Object.entries(tags)
    .filter(([key]) => /^(image\d*|wikimedia_commons)$/.test(key))
    .flatMap(([, value]) => value.split(";"));
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({ file: commonsFileName(value), url: /^https?:\/\//.test(value) ? value : null }))
    .filter((candidate) => candidate.file || candidate.url);
}

const OFFICIAL_OPERATORS = /^(rtg|npa|inpa|רשות הטבע והגנים|רט"ג|israel nature and parks authority)$/i;
const NIGHT_CAMP_NAME = /חניון|night ?camp|campsite kkl|kkl/i;

function toCampsite(element, places, translations, now) {
  const tags = element.tags;
  const point = element.center ?? { lat: element.lat, lon: element.lon };
  const coordinates = { lat: Math.round(point.lat * 1e5) / 1e5, lng: Math.round(point.lon * 1e5) / 1e5 };
  const isCaravan = tags.tourism === "caravan_site";

  const rawName = tags["name:he"] || tags.name || "";
  const he = HEBREW.test(rawName) ? rawName : tags["name:he"] || "";
  let en = tags["name:en"] || (HEBREW.test(tags.name || "") ? "" : tags.name) || translations[he] || "";
  const near = nearestPlace(coordinates, places);
  const nearHe = near?.he || near?.en;
  const nearEn = near?.en || near?.he;

  let name;
  if (he || en) {
    name = { he: he || en, en: en || he };
  } else {
    name = isCaravan
      ? { he: `חניון קרוואנים ליד ${nearHe}`, en: `Caravan site near ${nearEn}` }
      : { he: `חניון לילה ליד ${nearHe}`, en: `Night campsite near ${nearEn}` };
  }

  const operator = tags.operator || "";
  const isOfficial = OFFICIAL_OPERATORS.test(operator.trim());
  const kind = !isCaravan && (isOfficial || /^kkl$/i.test(operator) || NIGHT_CAMP_NAME.test(`${name.he} ${name.en}`) || !rawName)
    ? "nightCamp"
    : "campground";

  const fee = tags.fee;
  const isFree = fee !== undefined && /^no$/i.test(fee);
  const charge = /(\d+)/.exec(tags.charge || "");
  const pricing = {
    perNight: isFree ? 0 : charge ? Number(charge[1]) : null,
    currency: "ILS",
    isFree,
    ...(tags.charge ? { note: tags.charge } : {}),
  };

  const description = {};
  const descHe = tags["description:he"] || (HEBREW.test(tags.description || "") ? tags.description : "");
  const descEn = tags["description:en"] || (tags.description && !HEBREW.test(tags.description) ? tags.description : "");
  if (descHe) description.he = descHe;
  if (descEn) description.en = descEn;

  const contact = {};
  const phone = tags.phone || tags["contact:phone"];
  const website = tags.website || tags["contact:website"] || tags.url;
  const email = tags.email || tags["contact:email"];
  if (phone) contact.phone = phone.split(";")[0].trim();
  if (website) contact.website = website.split(";")[0].trim();
  if (email) contact.email = email.split(";")[0].trim();

  const osmUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  return {
    record: {
      id: `osm-${element.type}-${element.id}`,
      name,
      ...(Object.keys(description).length ? { description } : {}),
      coordinates,
      isOfficial,
      kind,
      region: regionFor(coordinates),
      ...(tags["addr:street"] || tags["addr:city"]
        ? { address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" ") }
        : {}),
      pricing,
      openingHours: tags.opening_hours ? { note: tags.opening_hours } : {},
      navigationUrls: {
        waze: `https://waze.com/ul?ll=${coordinates.lat}%2C${coordinates.lng}&navigate=yes&zoom=17`,
        googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat}%2C${coordinates.lng}&travelmode=driving`,
      },
      amenities: osmAmenities(tags),
      photos: [],
      contact,
      source: {
        name: "OpenStreetMap",
        url: osmUrl,
        coordsSource: `OpenStreetMap ${element.type} ${element.id}`,
        scrapedAt: now,
      },
      updatedAt: now,
    },
    photoCandidates: photoCandidates(tags),
    named: Boolean(rawName),
  };
}

// --- Photos (Wikimedia Commons) ---------------------------------------------------

async function commonsApi(params) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) console.warn(`  commons: ${error.message}`);
    }
  }
  return null;
}

/** Commons file titles → {url, credit} with an 960px thumbnail, in the given order. */
async function resolveCommonsFiles(titles) {
  if (!titles.length) return [];
  const data = await commonsApi({
    action: "query",
    titles: titles.map((t) => (t.startsWith("File:") ? t : `File:${t}`)).join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: String(PHOTO_WIDTH),
  });
  const pages = Object.values(data?.query?.pages ?? {});
  const byTitle = new Map();
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    const artist = (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
    const licence = info.extmetadata?.LicenseShortName?.value || "";
    byTitle.set(page.title, {
      url: info.thumburl || info.url,
      credit: ["Wikimedia Commons", artist, licence].filter(Boolean).join(" · ").slice(0, 160),
    });
  }
  // Normalise the asked titles the way the API does (underscores, "File:").
  return titles
    .map((t) => byTitle.get((t.startsWith("File:") ? t : `File:${t}`).replace(/_/g, " ")))
    .filter(Boolean);
}

const PHOTO_TITLE_HINT = /camp|tent|חניון|קמפינג|אוהל|מחנאות/i;

async function nearbyCommonsPhoto(record) {
  const data = await commonsApi({
    action: "query",
    list: "geosearch",
    gscoord: `${record.coordinates.lat}|${record.coordinates.lng}`,
    gsradius: String(PHOTO_RADIUS_M),
    gsnamespace: "6",
    gslimit: "30",
  });
  const hits = data?.query?.geosearch ?? [];
  const relevant = hits.filter(
    (hit) =>
      /\.(jpe?g|png|webp)$/i.test(hit.title) &&
      (PHOTO_TITLE_HINT.test(hit.title) || sharesWord(hit.title, record.name.en) || sharesWord(hit.title, record.name.he))
  );
  if (!relevant.length) return [];
  return resolveCommonsFiles(relevant.slice(0, 3).map((hit) => hit.title));
}

/** Commons answers in ~3 s from here, so a few requests run at once (well within its limits). */
const PHOTO_CONCURRENCY = 4;

async function addPhotos(items, previousPhotos) {
  let fromTags = 0;
  let fromNearby = 0;
  let done = 0;
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      await addPhotosTo(item);
      if (++done % 50 === 0) console.log(`  photos: ${done}/${items.length}`);
    }
  };
  async function addPhotosTo(item) {
    // Re-runs keep the photos already found, unless --refresh-photos.
    const previous = previousPhotos.get(item.record.id);
    if (previous && !args["refresh-photos"]) {
      item.record.photos = previous;
      if (previous.length) fromTags++;
      return;
    }
    const files = item.photoCandidates.filter((c) => c.file).map((c) => c.file);
    let photos = await resolveCommonsFiles(files.slice(0, 5));
    // Non-Commons image links: keep only ones that answer as an image.
    for (const candidate of item.photoCandidates.filter((c) => !c.file && c.url)) {
      try {
        const response = await fetch(candidate.url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        if (response.ok && /^image\//.test(response.headers.get("content-type") || "")) photos.push({ url: candidate.url });
      } catch {}
    }
    if (photos.length) fromTags++;
    else {
      photos = await nearbyCommonsPhoto(item.record);
      if (photos.length) fromNearby++;
    }
    item.record.photos = photos.slice(0, 5);
  }
  await Promise.all(Array.from({ length: PHOTO_CONCURRENCY }, worker));
  console.log(`  photos from the site's own tags: ${fromTags}, from Commons nearby: ${fromNearby}, none: ${items.length - fromTags - fromNearby}`);
}

// --- Main ---------------------------------------------------------------------------

async function main() {
  const now = new Date().toISOString();
  const dataset = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));
  const translations = fs.existsSync(TRANSLATIONS) ? JSON.parse(fs.readFileSync(TRANSLATIONS, "utf8")) : {};
  const inIsrael = makeIsraelTest();

  console.log("Loading OSM campsites...");
  const elements = await loadJson(
    args.campsites,
    `[out:json][timeout:170];nwr["tourism"~"^(camp_site|caravan_site)$"](${BBOX});out center tags;`
  );
  console.log("Loading OSM place names...");
  const placeElements = await loadJson(
    args.places,
    `[out:json][timeout:170];node["place"~"^(city|town|village|hamlet|locality|isolated_dwelling)$"](${BBOX});out tags center qt;`
  );
  const places = placeElements
    .filter((p) => p.tags.name && inIsrael({ lat: p.lat, lng: p.lon }))
    .map((p) => ({
      lat: p.lat,
      lng: p.lon,
      he: p.tags["name:he"] || (HEBREW.test(p.tags.name) ? p.tags.name : ""),
      en: p.tags["name:en"] || (HEBREW.test(p.tags.name) ? "" : p.tags.name),
      hebrewPrimary: HEBREW.test(p.tags.name),
    }))
    .filter((p) => p.he || p.en);

  // Existing records keep priority; the OSM ids already in the file are re-made.
  const existing = dataset.campsites.filter((c) => !c.id.startsWith("osm-"));
  const items = [];
  let outside = 0;
  let duplicates = 0;
  let junk = 0;
  for (const element of elements) {
    const point = element.center ?? (element.lat !== undefined ? { lat: element.lat, lon: element.lon } : null);
    if (!point) continue;
    if (!inIsrael({ lat: point.lat, lng: point.lon })) {
      outside++;
      continue;
    }
    if (/^(private|no)$/.test(element.tags.access || "") || element.tags.disused === "yes") continue;
    if (!looksLikeCampsite(element.tags, { lat: point.lat, lng: point.lon }, places)) {
      junk++;
      continue;
    }
    const item = toCampsite(element, places, translations, now);
    const sameName = (other) =>
      sharesWord(other.name.he, item.record.name.he) || sharesWord(other.name.en, item.record.name.en);
    // Against the existing records: generous, they win any doubt.
    const isExisting = (other) => {
      if (!other.coordinates) return false;
      const km = distanceKm(other.coordinates, item.record.coordinates);
      return km < DUPLICATE_KM || (km < DUPLICATE_NAMED_KM && sameName(other));
    };
    // Between OSM elements: strict, since separate campgrounds share
    // beaches and forests a few hundred metres apart.
    const isTwin = (other) => {
      const km = distanceKm(other.coordinates, item.record.coordinates);
      return km < 0.15 || (km < 1 && sameName(other));
    };
    if (existing.some(isExisting)) {
      duplicates++;
      continue;
    }
    const twin = items.find((other) => isTwin(other.record));
    if (twin) {
      // Keep the better-described of the two (named, more tags), merge photos.
      duplicates++;
      if (!twin.named && item.named) {
        item.photoCandidates.push(...twin.photoCandidates);
        items[items.indexOf(twin)] = item;
      } else twin.photoCandidates.push(...item.photoCandidates);
      continue;
    }
    items.push(item);
  }
  console.log(
    `  ${elements.length} OSM elements: ${outside} outside the map, ${junk} not campsites, ${duplicates} duplicates, ${items.length} new`
  );

  const untranslated = items.filter((i) => i.named && i.record.name.en === i.record.name.he && HEBREW.test(i.record.name.he));
  if (untranslated.length) {
    console.warn(`  ${untranslated.length} names have no English; add them to ${path.relative(ROOT, TRANSLATIONS)}:`);
    fs.writeFileSync(
      path.join(path.dirname(TRANSLATIONS), "untranslated.json"),
      JSON.stringify([...new Set(untranslated.map((i) => i.record.name.he))], null, 1)
    );
  }

  if (!args["no-photos"]) {
    console.log("Finding photos...");
    const previousPhotos = new Map(
      dataset.campsites.filter((c) => c.id.startsWith("osm-")).map((c) => [c.id, c.photos])
    );
    await addPhotos(items, previousPhotos);
  }

  // Unique names for unnamed sites near the same town: "(2)", "(3)"...
  const seen = new Map();
  for (const { record } of items) {
    const count = (seen.get(record.name.he) ?? 0) + 1;
    seen.set(record.name.he, count);
    if (count > 1) record.name = { he: `${record.name.he} (${count})`, en: `${record.name.en} (${count})` };
  }

  const osm = items.map((i) => i.record);
  const sources = dataset.sources.filter((s) => s.name !== "OpenStreetMap");
  sources.push({ name: "OpenStreetMap", url: "https://www.openstreetmap.org/", isOfficial: false, count: osm.length });
  const out = { generatedAt: now, sources, campsites: [...existing, ...osm] };

  const byRegion = {};
  for (const r of osm) byRegion[r.region] = (byRegion[r.region] ?? 0) + 1;
  console.log("  new sites by region:", byRegion);
  console.log(`  kinds: ${osm.filter((r) => r.kind === "nightCamp").length} night camps, ${osm.filter((r) => r.kind === "campground").length} campgrounds`);

  if (args["dry-run"]) return console.log("Dry run, nothing written.");
  fs.writeFileSync(CAMPSITES, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${out.campsites.length} campsites to ${path.relative(ROOT, CAMPSITES)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
