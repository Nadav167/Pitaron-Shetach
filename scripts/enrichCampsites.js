#!/usr/bin/env node
/**
 * enrichCampsites.js — fills in the blanks (description, amenities, price,
 * hours, directions, phone, photos) of the sites the dataset already has,
 * from the two sources that publish details for many sites at once.
 *
 * ---------------------------------------------------------------------------
 * SOURCES, MOST TRUSTED FIRST
 *
 *   1. Israel Nature and Parks Authority (parks.org.il). Its WordPress REST
 *      API serves every night camp as structured data:
 *        /wp-json/wp/v2/free_camping  ~108 free "sign camps" (חניוני שלט):
 *            description, the nature reserve, facilities ("מתקנים באתר"),
 *            cell reception, access (any car / 4X4), directions, the
 *            coordinates, photos with credits, nearby trails;
 *        /wp-json/wp/v2/camping       ~19 paid night camps: "מה בחניון?"
 *            facility lists, stay options, directions, check-out time.
 *      Government text, used as published, credited to the Authority.
 *   2. tiuli.com camping pages (see lib/tiuliPage.js): a facility row
 *      ("ברז מים", "שירותים", "חיבור לחשמל", "בתשלום"), the access note,
 *      a summary, hours, prices, a phone. tiuli's articles are its own
 *      editorial copy, so only the facts and the short summary are taken,
 *      never the article itself.
 *
 * FILL, NEVER OVERWRITE
 *   A value the record already has wins; a source only fills what's empty,
 *   and an earlier source wins over a later one. An amenity key is only
 *   set where the source is explicit: absent still means "unknown". A
 *   wrong "there's water" can strand someone in the desert, a missing one
 *   can't, so water/toilets are only ever set to true from a facility
 *   list, never guessed from prose.
 *
 *   Every record a source contributed to lists it in source.extraSources.
 *
 * MATCHING A SOURCE PAGE TO A RECORD
 *   tiuli-<id> records are their own page. Otherwise: the closest record
 *   within MATCH_KM, or within MATCH_NAMED_KM when the names share a word
 *   (the same rule the importers use for duplicates), or the same name
 *   once "חניון לילה" etc. are stripped. A record takes at most one page
 *   per source, the closest.
 *
 *   INPA free camps that match no record are added as new night camps:
 *   they're official, mapped, designated places to sleep.
 *
 * USAGE
 *   node scripts/enrichCampsites.js --tiuli=tiuli.json [--cache=dir] [--dry-run]
 *     --tiuli   a saved crawl of tiuli.com (crawling takes ~15 minutes;
 *               lib/tiuliPage.js `crawl(720)` makes one).
 *     --cache   read/write the INPA API responses from/to this directory.
 * ---------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const { CAMPSITES, distanceKm, words, regionFor, navigationUrls, parseArgs } = require("./lib/importHelpers");
const { decode } = require("./lib/tiuliPage");

const MATCH_KM = 0.4;
const MATCH_NAMED_KM = 3;
const NAME_MATCH_KM = 25;
const SAME_SPOT_KM = 0.1;
const DESCRIPTION_MAX = 900;
const SHORT_NOTE = 120;
const TIULI_SUMMARY_MAX = 400;
const INPA = "https://www.parks.org.il/wp-json/wp/v2";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DESERT = new Set(["Negev", "Arava", "Eilat", "DeadSea"]);

const args = parseArgs();

// --- Helpers -----------------------------------------------------------------------

const html = (text) => decode(String(text || "").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…").replace(/<[^>]+>/g, " "));

/** Name without the generic words, for matching "חניון לילה X" to "X". */
const core = (name) =>
  name
    .replace(/&#8211;/g, "–")
    .replace(/חניון( הלילה| לילה)?|ליד|קמפינג|\(.*?\)/g, "")
    .replace(/בארות/g, "באר")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Cuts at the last sentence or line end before `max` characters. */
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"), cut.lastIndexOf("."));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { items: await response.json(), total: Number(response.headers.get("x-wp-total") || 0) };
}

/** All items of a WordPress post type, cached in --cache when given. */
async function wpAll(type) {
  const cached = args.cache && path.join(args.cache, `inpa-${type}.json`);
  if (cached && fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8"));
  let all = [];
  for (let page = 1; ; page++) {
    const { items, total } = await getJson(`${INPA}/${type}?per_page=100&page=${page}`);
    all = all.concat(items);
    if (all.length >= total || items.length < 100) break;
  }
  if (cached) fs.writeFileSync(cached, JSON.stringify(all));
  return all;
}

/** Sets an amenity only if the record doesn't know it yet. */
function setAmenity(record, key, value) {
  if (value === undefined || record.amenities[key] !== undefined) return false;
  record.amenities[key] = value;
  return true;
}

/**
 * A record with no Hebrew description gets `text`. One with only a short
 * mapper's note ("חניון חשוף לרוחות וללא צל", most OSM descriptions) gets
 * `text` first and keeps the note after it: firsthand, and often the one
 * thing the official text doesn't say.
 */
function fillDescription(record, text) {
  const current = record.description?.he || "";
  if (!text || current.length >= SHORT_NOTE || (current && text.includes(current))) return false;
  // An official "camping isn't allowed here" (see applyKinneret) stays first.
  const warning = record.source.needsReview && /^לפי /.test(current);
  record.description = { ...record.description, he: !current ? text : warning ? `${current}\n${text}` : `${text}\n${current}` };
  return true;
}

function addSource(record, name, url) {
  const list = (record.source.extraSources = record.source.extraSources || []);
  if (!list.some((s) => s.url === url)) list.push({ name, url });
}

/**
 * Shares a distinctive name word. Stricter than the importers' sharesWord:
 * "חאן", "חוות", "נחל"... name dozens of different places, so "חאן דרך
 * הבשמים" and "חאן שירת הערבה" 900 m apart are two businesses.
 */
const GENERIC = new Set("חאן חוות כפר הנופש נחל הר עין באר מצפה פארק בית אוהל בגולן בנגב בגליל במדבר בכרמל".split(" "));
function sharesName(a, b) {
  const own = new Set(words(a).filter((word) => !GENERIC.has(word)));
  return words(b).some((word) => own.has(word));
}

/**
 * Finds the record a source page describes (see MATCHING above).
 * `claimed`: the core names of all of this source's pages.
 * `strict`: a bare proximity match needs the names to agree too, unless
 * the two points are within SAME_SPOT_KM. tiuli lists businesses side by
 * side (a kayak village 400 m from a free night camp); INPA's free camps,
 * matched only against night camps, don't need it.
 */
function matchRecord(records, name, point, claimed = new Set(), strict = false) {
  // 1. The closest record within MATCH_KM, skipping a record whose name
  //    another page of this source carries: that page is the record's own,
  //    this one is a neighbour (INPA's "באר אשלים – לקבוצות" is next to
  //    its "נחל פארן").
  let best = null;
  let bestKm = Infinity;
  if (point) {
    for (const record of records) {
      if (!record.coordinates || (claimed.has(core(record.name.he)) && core(record.name.he) !== core(name))) continue;
      const km = distanceKm(point, record.coordinates);
      if (km < bestKm) [best, bestKm] = [record, km];
    }
  }
  if (best && bestKm < MATCH_KM && (!strict || bestKm < SAME_SPOT_KM || sharesName(name, best.name.he))) {
    return { record: best, km: bestKm };
  }

  // 2. The same name a few km off: a source's coordinates can be wrong
  //    (INPA gives "בארות עדה" the coordinates of באר כרכום, 16 km away).
  //    Wider than that is a different spot on the same long wadi.
  const sameName = records
    .filter((record) => core(record.name.he) === core(name))
    .map((record) => ({ record, km: point && record.coordinates ? distanceKm(point, record.coordinates) : null }))
    .filter(({ km }) => km == null || km < NAME_MATCH_KM)
    .sort((x, y) => (x.km ?? 0) - (y.km ?? 0));
  if (sameName.length) return sameName[0];

  // 3. A shared name word within MATCH_NAMED_KM.
  if (best && bestKm < MATCH_NAMED_KM && sharesName(name, best.name.he)) return { record: best, km: bestKm };
  return null;
}

/** Keeps, for each record, only the closest of the pages matched to it. */
function closestPerRecord(matches) {
  const byRecord = new Map();
  for (const match of matches) {
    const other = byRecord.get(match.record.id);
    const exact = core(match.record.name.he) === core(match.name);
    const otherExact = other && core(other.record.name.he) === core(other.name);
    if (!other || (exact && !otherExact) || (exact === otherExact && (match.km ?? 99) < (other.km ?? 99))) {
      byRecord.set(match.record.id, match);
    }
  }
  const kept = new Set(byRecord.values());
  return { kept: [...kept], dropped: matches.filter((m) => !kept.has(m)) };
}

// --- INPA free camps ("sign camps") ---------------------------------------------------

/** Coordinates of a free camp: the field names say lat/lng but hold lng/lat, and some are blank. */
function freeCampCoordinates(camp) {
  const world = (/עולמית:\s*([^<]+)/.exec(camp.content.rendered) || [])[1] || "";
  const numbers = [camp.acf.lat_lng_waze, camp.acf.long_lng_waze, ...world.split("/")]
    .map((value) => parseFloat(String(value).trim()))
    .filter(Number.isFinite);
  const lat = numbers.find((n) => n > 29 && n < 33.5);
  const lng = numbers.find((n) => n > 34 && n < 36);
  return lat && lng ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } : null;
}

/** "מידע שימושי" list items: { "מתקנים באתר": "מים, שירותים", "גישה": "4X4", ... }. */
function usefulInfo(content) {
  const info = {};
  for (const match of content.matchAll(/<li>([^:<]+):\s*([\s\S]*?)<\/li>/g)) info[html(match[1])] = html(match[2]);
  return info;
}

/** Paragraphs under an <h2> heading, up to the next one. */
function sectionText(content, heading) {
  const match = new RegExp(`<h2>\\s*${heading}\\s*</h2>([\\s\\S]*?)(?=<h2>|$)`).exec(content);
  if (!match) return "";
  return [...match[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => html(m[1])).filter(Boolean).join("\n");
}

function photosOf(content) {
  const photos = [];
  for (const match of content.matchAll(/<img[^>]*src="([^"]+)"[^>]*>\s*<div class="desc_img_and_caption">([^<]*)<\/div>/g)) {
    photos.push({
      url: match[1].replace("://writer.parks.org.il/", "://www.parks.org.il/").replace(/ /g, "%20"),
      credit: `רשות הטבע והגנים, ${html(match[2])}`,
    });
  }
  return photos.slice(0, 3);
}

/** What one free camp tells us, in the dataset's terms. */
function readFreeCamp(camp) {
  const content = camp.content.rendered;
  const info = usefulInfo(content);
  const facilities = info["מתקנים באתר"] ?? "";
  const listed = facilities && !/^[–-]?$|^אין$/.test(facilities);
  const holidaysOnly = /בחגים/.test(facilities);
  // With a facility list (or the explicit "none") the Authority is telling
  // us what's there and, by omission, what isn't: these camps have no
  // infrastructure beyond what's listed (and no bins, per its FAQ).
  const has = (re) => (re.test(facilities.replace(/בחגים[^,.]*/g, "")) ? true : false);
  const amenities = {
    water: has(/מים|ברז/),
    toilets: holidaysOnly && !has(/שירותים/) ? undefined : has(/שירותים/),
    shade: has(/סהרונים|סככות|עצי צל/) || undefined,
    picnicTables: has(/שולחנות/) || undefined,
    wasteDisposal: has(/פח/),
    electricity: false,
    shower: false,
  };
  if (!listed && !facilities) {
    // No facility line at all: only the acf flags.
    amenities.water = camp.acf.water === true;
    amenities.toilets = camp.acf.toilet === true;
  }
  const reception = info["קליטה סלולרית"] || "";
  const access = info["גישה"] || "";
  const reserve = info["שמורת טבע"] || (camp.acf.declared_reserve ? camp.acf.map_description || "שמורת טבע" : "");
  const trails = sectionText(content, "מסלולי טיול קרובים");
  const capacity = Number(info["מספר מקומות לינה"]) || null;
  return {
    name: html(camp.title.rendered),
    url: decodeURI(camp.link),
    coordinates: freeCampCoordinates(camp),
    description: sectionText(content, "תיאור"),
    trails,
    capacity,
    reserve,
    amenities: {
      ...amenities,
      cellReception: /^(יש|כן)$/.test(reception) ? true : /^(אין|לא)$/.test(reception) ? false : undefined,
      fourByFourRequired: /4X4/i.test(access) ? true : /רכב/.test(access) ? false : undefined,
    },
    accessNote: /באופן זמני/.test(access) ? access : "",
    directions: info["הנחיות הגעה"] || "",
    photos: photosOf(content),
  };
}

function freeCampDescription(camp, region) {
  const parts = ['חניון שלט של רשות הטבע והגנים: לינת שטח ללא תשלום וללא הזמנה מראש, פתוח לכולם.'];
  if (camp.description) parts.push(clip(camp.description, 600));
  if (camp.amenities.water && DESERT.has(region)) {
    parts.push("המים במכלים מוגבלים ומיועדים לשתייה ולבישול בלבד; יש להגיע עם מספיק מים.");
  }
  if (camp.accessNote) parts.push(camp.accessNote);
  if (camp.capacity) parts.push(`כ-${camp.capacity} מקומות לינה.`);
  if (camp.trails) parts.push(`מסלולי טיול קרובים: ${camp.trails.replace(/\n/g, ", ")}`);
  return clip(parts.join("\n"), DESCRIPTION_MAX + 300);
}

function applyFreeCamp(record, camp) {
  const changed = [];
  if (fillDescription(record, freeCampDescription(camp, record.region))) changed.push("description");
  for (const [key, value] of Object.entries(camp.amenities)) if (setAmenity(record, key, value)) changed.push(key);
  if (!record.pricing.isFree && record.pricing.perNight == null) {
    record.pricing = { ...record.pricing, perNight: 0, isFree: true, note: record.pricing.note || "ללא תשלום (חניון שלט של רשות הטבע והגנים)" };
    changed.push("price");
  }
  if (!record.openingHours.note) {
    record.openingHours = {
      ...record.openingHours,
      note: camp.reserve
        ? "פתוח לכולם, ללא הזמנה. החניון בשמורת טבע: אין להגיע אחרי רדת החשכה."
        : "פתוח לכולם, ללא הזמנה מראש.",
    };
    changed.push("hours");
  }
  if (!record.directions?.he && camp.directions) {
    record.directions = { he: camp.directions };
    changed.push("directions");
  }
  if (!record.coordinates && camp.coordinates) {
    record.coordinates = camp.coordinates;
    record.navigationUrls = navigationUrls(camp.coordinates);
    record.source.coordsSource = `parks.org.il (${camp.name})`;
    changed.push("coordinates");
  }
  if (!record.photos.some((photo) => !photo.isPlaceholder) && camp.photos.length) {
    record.photos = camp.photos;
    changed.push("photos");
  }
  if (!record.contact.website) {
    record.contact = { ...record.contact, website: camp.url };
    changed.push("website");
  }
  if (record.kind !== "nightCamp" && !record.isOfficial) record.kind = "nightCamp";
  if (changed.length) addSource(record, "parks.org.il", camp.url);
  return changed;
}

function newFreeCampRecord(wpId, camp, now) {
  const record = {
    id: `inpa-free-${wpId}`,
    name: { he: camp.name, en: camp.name },
    coordinates: camp.coordinates,
    isOfficial: false,
    kind: "nightCamp",
    region: regionFor(camp.coordinates),
    pricing: { perNight: null, currency: "ILS", isFree: false },
    openingHours: {},
    navigationUrls: navigationUrls(camp.coordinates),
    amenities: {},
    photos: [],
    contact: {},
    source: { name: "parks.org.il", url: camp.url, coordsSource: "parks.org.il free night camp page", scrapedAt: now },
    updatedAt: now,
  };
  applyFreeCamp(record, camp);
  delete record.source.extraSources;
  return record;
}

// --- INPA paid night camps --------------------------------------------------------------

function tab(camp, name) {
  return (camp.acf.rp_tab || []).find((t) => t.name.replace(/[​\s]/g, "").includes(name.replace(/\s/g, "")));
}

/** "מה בחניון?" bullet list → amenities that are confirmed present. */
function paidCampAmenities(camp) {
  const list = (tab(camp, "מה בחניון?")?.content || "").replace(/<[^>]+>/g, " ");
  const filters = { ...camp.acf.map_filters_facilities, ...camp.acf.map_filters_camping_facilities };
  const present = (re) => re.test(list) || undefined;
  return {
    water: present(/ברזיות|מי שתייה|ברזי מים/) || (filters.drinking_water_f ? true : undefined),
    toilets: present(/שירותים/) || (filters.restrooms_f ? true : undefined),
    shower: present(/מקלחות/) || (filters.hot_wate_f || camp.acf.Hot_water_shower_s ? true : undefined),
    shade: present(/סככ|צל/),
    picnicTables: present(/שולחנות|ספסלים/),
    electricity: present(/חשמל/) || (camp.acf.electricity_s ? true : undefined),
    // Every paid INPA camp has a paved approach and a gate.
    fourByFourRequired: false,
  };
}

function paidCampDescription(camp) {
  const parts = [html(camp.excerpt.rendered)];
  const stay = tab(camp, "אפשרויות לינה")?.content || "";
  const options = [...stay.matchAll(/<h4>([\s\S]*?)<\/h4>/g)].map((m) => html(m[1])).filter(Boolean);
  if (options.length) parts.push(`אפשרויות לינה: ${options.join(" · ")}`);
  const rules = html(tab(camp, "מידע למבקר")?.content || "");
  if (/אין כניסה לכלבים|הכניסה לכלבים אסורה|אסור להכניס כלבים/.test(rules)) parts.push("אין כניסה לכלבים.");
  if (/רק עם הזמנה|אך ורק עם הזמנה/.test(rules)) parts.push("הכניסה בהזמנה מראש בלבד, דרך אתר רשות הטבע והגנים.");
  // "מסלולים ואתרים בסביבה": lists of links, trails then sites.
  const nearby = [...(tab(camp, "מסלולים ואתרים בסביבה")?.content || "").matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((m) => html(m[1]).replace(/^מסלול טיול\s*[–-]\s*/, ""))
    .filter(Boolean);
  if (nearby.length) parts.push(clip(`בסביבה: ${nearby.join(", ")}`, 250));
  return clip(parts.filter(Boolean).join("\n"), DESCRIPTION_MAX);
}

function applyPaidCamp(record, camp) {
  const changed = [];
  const url = decodeURI(camp.link);
  if (fillDescription(record, paidCampDescription(camp))) changed.push("description");
  for (const [key, value] of Object.entries(paidCampAmenities(camp))) if (setAmenity(record, key, value)) changed.push(key);
  const arrive = html(camp.acf.rp_info_arrive?.[0]?.rp_info_arriveDesc || "");
  if (!record.directions?.he && arrive) {
    record.directions = { he: arrive };
    changed.push("directions");
  }
  const checkOut = /לפנות[^.]*?עד השעה (\d{1,2}:\d{2})/.exec(html(camp.acf.camp_open_hour || ""));
  if (!record.openingHours.checkOut && checkOut) {
    record.openingHours = { ...record.openingHours, checkOut: checkOut[1] };
    changed.push("checkOut");
  }
  if (changed.length) addSource(record, "parks.org.il", url);
  return changed;
}

// --- KKL forest night camps ---------------------------------------------------------------

/**
 * kkl.org.il's night camp pages carry no coordinates (a handful embed a
 * map link), so they're matched by hand: page path → record id, each pair
 * checked by name and region. KKL camps with no record here aren't in the
 * dataset yet.
 */
const KKL_PAGES = {
  "/travel/campground_ein_zivan/": "gc-ein-zivan-night-campground",
  "/travel/campground_dvora/": "osm-node-11990241617",
  "/travel/campground_switzerland/": "osm-node-5598295959",
  "/travel/campground_bar_giora/": "osm-node-6430359000",
  "/travel/campground_uk/": "osm-node-9674806817",
  "/travel/campground_kisalon/": "osm-node-8019505681",
  "/travel/campground_dalyot/": "osm-node-2604848084",
  "/travel/campground_ein_kobi/": "osm-node-3493374314",
  "/travel/campground_usa_park/": "osm-node-11699044234",
  "/travel/campground_palsar7/": "osm-way-1053679682",
  "/travel/campground_baraam/": "osm-node-8042139350",
  "/travel/campground_aminadav/": "osm-node-3493631382",
  "/travel/campground_gachar/": "osm-node-665044705",
  "/travel/campground_shoresh/": "osm-node-11932962969",
  "/travel/campground_hofhacarmel/": "osm-node-11991816696",
  "/travel/campground_har_eitan/": "osm-node-5088501825",
  "/travel/campground_ver_ref/": "osm-node-12439486754",
  "/travel/campground_ben_shemen/": "osm-node-11220240583",
};
const KKL = "https://www.kkl.org.il";

/** A KKL page → its text lines between the notices banner and the footer. */
async function kklPage(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return null;
  const page = await response.text();
  const lines = page
    .replace(/\s+/g, " ")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<(\/p|br|\/li|\/h\d|\/div|\/tr|\/td)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map(decode)
    .filter(Boolean);
  const start = lines.findIndex((line) => /סגור הודעות קק"ל למטיילים/.test(line));
  const end = lines.findIndex((line, i) => i > start && /^הרשמה לניוזלטר/.test(line));
  const image = (/og:image" content="([^"]*)/.exec(page) || [])[1] || null;
  return start < 0 ? null : { url, body: lines.slice(start + 2, end), image };
}

async function kklPages() {
  const cached = args.cache && path.join(args.cache, "kkl.json");
  if (cached && fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8"));
  const pages = [];
  for (const pathname of Object.keys(KKL_PAGES)) {
    const page = await kklPage(KKL + pathname);
    if (page) pages.push({ ...page, path: pathname });
    await new Promise((r) => setTimeout(r, 400));
  }
  if (cached) fs.writeFileSync(cached, JSON.stringify(pages));
  return pages;
}

/**
 * A KKL page is prose with FAQ-style questions in it: "מה באתר? שולחנות
 * פיקניק, מים לשתייה. איך מגיעים לחניון? מכיכר הולנד... תיאום: <email>".
 * Splits it into the lead (before the first question) and question →
 * answer pairs. Notices about the site ("החל מתאריך 24.1.2024 ... סגורים")
 * open the lead and are kept, dated, since they're what a visitor most
 * needs to know.
 */
function readKkl(page) {
  const text = page.body.slice(0, 1).join(" ");
  const questions = /((?:מה|האם|איך|מהי|מהו|כמה|היכן|מתי|אילו)[^.?!:]{1,70}\?)/g;
  const marks = [...text.matchAll(questions)];
  const lead = marks.length ? text.slice(0, marks[0].index) : text;
  const answers = marks.map((m, i) => ({
    q: m[1],
    a: text.slice(m.index + m[1].length, marks[i + 1]?.index ?? text.length).trim(),
  }));
  const answer = (re) => answers.find(({ q }) => re.test(q))?.a || "";
  // "גישה:" / "תיאום:" are labels inside an answer rather than questions.
  const label = (name) => (new RegExp(`${name}:\\s*([^]*?)(?=\\s(?:תיאום|הערות ומגבלות|לתשומת לבכם|${page.body[0]}):|$)`).exec(text) || [])[1]?.trim() || "";
  const facilities = answer(/^מה (יש )?ב(אתר|חניון|מקום|חניונים)/);
  const all = `${lead} ${facilities}`;
  // Notices come either as a numbered list opening the page ("1. ... 2.
  // ...", each item ending at its first full stop that isn't inside a date)
  // or as a lone dated sentence.
  let notices = [];
  let intro = lead;
  if (/^\d\.\s/.test(lead)) {
    const starts = [...lead.matchAll(/(?:^|\s)\d\.\s/g)];
    const last = starts[starts.length - 1];
    const end = lead.indexOf(". ", last.index + last[0].length);
    const list = end < 0 ? lead : lead.slice(0, end + 1);
    notices = list.split(/(?:^|\s)\d\.\s/).map((s) => s.trim()).filter(Boolean);
    intro = end < 0 ? "" : lead.slice(end + 1);
  }
  const sentences = intro.split(/(?<=\.)\s+/);
  notices.push(...sentences.filter((s) => /החל מתאריך|עד להודעה חדשה/.test(s)));
  intro = sentences.filter((s) => !/החל מתאריך|עד להודעה חדשה/.test(s)).join(" ").trim();
  const groupWater = /מים לקבוצות|למים לקבוצות|בתיאום מראש בלבד/.test(facilities);
  // A notice that the water is off ("אין מים", "המים במקום סגורים") beats the FAQ's "yes".
  const water = /אין מים|המים[^.]*סגור|מים[^.]*מנותק/.test(all)
    ? undefined
    : /^כן/.test(answer(/מים/)) || (!groupWater && /מים לשתייה|ברזי?ה|ברז מים/.test(facilities))
      ? true
      : undefined;
  const email = (/[\w.+-]+@kkl\.org\.il/.exec(text) || [])[0];
  const phone = (/טל'?:?\s*(0\d[\d-]{7,11})/.exec(text) || [])[1];
  const permit = /מחייבת אישור מראש|נדרש אישור ללינה\? כן/.test(text);
  const smallGroups = (/מתחת ל-?\d+ איש אין צורך בתאום[^.]*\.[^.]*\./.exec(text) || [])[0];
  return {
    url: page.url,
    image: page.image,
    lead: intro,
    notices,
    amenities: {
      water,
      toilets: /שירותים[^.]*סגורים/.test(all) ? false : /שירותים/.test(facilities) ? true : undefined,
      picnicTables: /שולחנות/.test(all) || undefined,
      shade: /בצל|סככ/.test(facilities) || undefined,
    },
    // Without the photo caption or link text that follows the last sentence.
    directions: (answer(/^איך מגיעים/) || label("גישה")).replace(/(\.)\s+[^.]{1,40}$/, "$1"),
    email,
    phone,
    booking: permit
      ? 'הלינה מחייבת אישור מראש מקק"ל (ראו פרטי התיאום).'
      : smallGroups || (email ? 'לתיאום לינה מול קק"ל ראו פרטי הקשר.' : ""),
  };
}

function applyKkl(record, kkl) {
  const changed = [];
  const asOf = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const parts = [];
  if (kkl.notices.length) parts.push(`הודעות קק"ל (נכון ל${asOf}): ${kkl.notices.join(" ")}`);
  if (kkl.lead) parts.push(clip(kkl.lead, 400));
  if (fillDescription(record, parts.join("\n"))) changed.push("description");
  for (const [key, value] of Object.entries(kkl.amenities)) if (setAmenity(record, key, value)) changed.push(key);
  if (!record.directions?.he && kkl.directions) {
    // Without the trailing "<caption> תיאום לינה: <email>".
    record.directions = { he: clip(kkl.directions.replace(/\s*[^.]*תיאום[^:.]*:.*$/, ""), 500) };
    changed.push("directions");
  }
  if (!record.openingHours.note && kkl.booking) {
    record.openingHours = { ...record.openingHours, note: kkl.booking };
    changed.push("hours");
  }
  if (!record.contact.email && kkl.email) {
    record.contact = { ...record.contact, email: kkl.email };
    changed.push("email");
  }
  if (!record.contact.phone && kkl.phone) {
    record.contact = { ...record.contact, phone: kkl.phone };
    changed.push("phone");
  }
  if (!record.contact.website) {
    record.contact = { ...record.contact, website: kkl.url };
    changed.push("website");
  }
  if (!record.photos.some((photo) => !photo.isPlaceholder) && kkl.image) {
    record.photos = [{ url: kkl.image, credit: 'קק"ל' }];
    changed.push("photos");
  }
  if (changed.length) addSource(record, "kkl.org.il", kkl.url);
  return changed;
}

// --- Kinneret beaches (איגוד ערים כינרת) -----------------------------------------------

/**
 * ikinneret.org.il has a page per Kinneret beach with fixed headings:
 * "קמפינג / לינה" (camping allowed? facilities), "מידע נוסף" (rules),
 * "כניסה לחוף", "חנייה בתשלום", "איך מגיעים", "טלפון". Several beaches
 * share one set of coordinates on the site (כורסי / לבנון / חלוקים), so
 * the pairs are by hand: page slug → record id.
 *
 * Camping at the association's beaches is paid for as parking, per car
 * per hour; there's no per-person price, so perNight stays unknown and
 * the tariff goes in the price note.
 */
const KINNERET_BEACHES = {
  "חוף-שקמים-חוף-שקט": "osm-node-2466847612",
  "חוף-ברניקי-חוף-שקט": "tiuli-375",
  "חוף-צינברי": "tiuli-382",
  "חוף-גופרה": "osm-node-683315617",
  "חוף-דוגית-גולן": "osm-node-9717142730",
  "חוף-דוגה": "tiuli-377",
  "חוף-מפרץ-אמנון": "osm-node-4367588189",
  "חוף-סוסיתא": "osm-node-683315611",
  "חוף-צמח": "osm-node-1492528122",
  "חוף-חוקוק-צפון": "tiuli-438",
  "חוף-חלוקים-לבנון-כורסי": "tiuli-386",
  "חוף-רותם-שיזף": "tiuli-384",
  "חניון-רסטל-מגדלא": "osm-node-5224367395",
  "מעגן-עדן-כפר-נופש": "osm-node-683315600",
  "חניון-האון": "tiuli-379",
  "גן-לאומי-כפר-נחום": "tiuli-385",
  "חוף-גנים": "tiuli-389",
  "חניון-חוף-תמר": "tiuli-387",
};
const KINNERET_TARIFF =
  "כניסה להולכי רגל חינם; החניה בתשלום לפי מחירון איגוד ערים כינרת: עד 5 ₪ לשעה לרכב פרטי (50% הנחה לחיילים).";
const KINNERET_HEADINGS = [
  "פרטי החוף", "רשות אחראית", "סטטוס", "אורך החוף (במטרים)", "חוף מוכרז", "שמירת חפצים", "טלפון",
  "טלפון נוסף", "אתר אינטרנט", "מידע נוסף", "אוטובוסים", "נקודת ציון גיאוגרפית", "איך מגיעים",
  "קמפינג / לינה", "גישה לאנשים עם מוגבלויות", "חנייה בתשלום", "כניסה לחוף",
];

async function kinneretPages() {
  const cached = args.cache && path.join(args.cache, "ikinneret.json");
  if (cached && fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8"));
  const pages = [];
  for (const slug of Object.keys(KINNERET_BEACHES)) {
    const url = `https://ikinneret.org.il/beaches/${slug}/`;
    const response = await fetch(encodeURI(url), { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) continue;
    const lines = toLines(await response.text());
    const start = lines.indexOf("פרטי החוף");
    const end = lines.findIndex((l, i) => i > start && /^(עודכן בתאריך|הקלידו את כתובת המוצא|כוכבית כינרת$)/.test(l));
    if (start > 0) pages.push({ url, title: lines[start - 1], lines: lines.slice(start, end) });
    await new Promise((r) => setTimeout(r, 300));
  }
  if (cached) fs.writeFileSync(cached, JSON.stringify(pages));
  return pages;
}

function toLines(page) {
  return page
    .replace(/\s+/g, " ")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<(\/p|br|\/li|\/h\d|\/div|\/tr|\/td)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;/g, "–")
    .split("\n")
    .map(decode)
    .filter(Boolean);
}

function readKinneret(page) {
  const sections = {};
  let current = null;
  for (const line of page.lines) {
    if (KINNERET_HEADINGS.includes(line)) sections[(current = line)] = [];
    else if (current) sections[current].push(line);
  }
  const get = (name) => (sections[name] || []).join(" ").trim();
  const camping = get("קמפינג / לינה");
  const info = sections["מידע נוסף"] || [];
  const facilitiesLine = [camping, ...info.filter((l) => /שירותים|שרותים|מקלחות|שולחנות|ברזיות/.test(l))].join(" ");
  const forbidden = /אסורה הלינה בכל|אין קמפינג|אין לינת קמפינג|לינה בחדרי הנופש בלבד|^אסור|^אין\.?$/.test(camping);
  const has = (re) => (re.test(facilitiesLine) ? true : undefined);
  const parts = [];
  if (forbidden) parts.push(`לפי איגוד ערים כינרת: ${camping}`);
  else if (camping && !/^יש לשים לב לשילוט/.test(camping)) parts.push(camping);
  const facilities = info.find((l) => /שירותים|שרותים|מקלחות|שולחנות/.test(l) && l !== camping);
  if (facilities) parts.push(facilities);
  if (info.includes("חוף שקט!")) parts.push("חוף שקט: אסורה השמעת מוזיקה ומערכות הגברה.");
  if (info.some((l) => /כלבים לתחום חניון הנופש – מותרת/.test(l))) parts.push("כלבים מותרים בחניון הנופש, קשורים ברצועה.");
  const entry = get("כניסה לחוף");
  const parking = get("חנייה בתשלום");
  const phone = (/\*\d{4,5}|0\d[\d-]{7,10}/.exec(get("טלפון")) || [])[0];
  return {
    url: page.url,
    forbidden,
    description: parts.join("\n"),
    amenities: forbidden
      ? {}
      : {
          toilets: has(/שירותים|שרותים/),
          shower: has(/מקלחות|מלתחות/),
          water: has(/ברזיות|מי שתייה/),
          shade: has(/צל|מצללות|סככות/),
          picnicTables: has(/שולחנות/),
          electricity: has(/חשמל/),
          fourByFourRequired: false,
        },
    priceNote: /לפי מחירון האיגוד/.test(parking) && /חינם/.test(entry) ? KINNERET_TARIFF : /בתשלום/.test(entry) ? `כניסה לחוף בתשלום. ${parking}`.trim() : "",
    directions: get("איך מגיעים"),
    phone,
  };
}

function applyKinneret(record, beach) {
  const changed = [];
  if (beach.forbidden) {
    // Says the opposite of what the record is listed for: it goes first,
    // whatever the description was, and the record is flagged.
    const current = record.description?.he || "";
    if (!current.startsWith("לפי איגוד ערים כינרת")) {
      record.description = { ...record.description, he: current ? `${beach.description}\n${current}` : beach.description };
      changed.push("description");
    }
    record.source.needsReview = true;
  } else if (fillDescription(record, beach.description)) changed.push("description");
  for (const [key, value] of Object.entries(beach.amenities)) if (setAmenity(record, key, value)) changed.push(key);
  if (!record.pricing.note && beach.priceNote && !beach.forbidden) {
    record.pricing = { ...record.pricing, note: beach.priceNote };
    changed.push("priceNote");
  }
  if (!record.directions?.he && beach.directions) {
    record.directions = { he: beach.directions };
    changed.push("directions");
  }
  if (!record.contact.phone && beach.phone) {
    record.contact = { ...record.contact, phone: beach.phone };
    changed.push("phone");
  }
  if (changed.length) addSource(record, "ikinneret.org.il", beach.url);
  return changed;
}

// --- tiuli.com ---------------------------------------------------------------------------

/** tiuli's own text minus its boilerplate lines. */
function tiuliSummary(page) {
  if (page.summary) return clip(page.summary, TIULI_SUMMARY_MAX);
  // No summary: the article's first real paragraph, if it's short enough
  // to be a summary rather than the article.
  const first = page.article
    .split("\n")
    .find((line) => line.length > 60 && !/^(כל המידע על|•)/.test(line) && !/להזמנת|מידע נוסף/.test(line));
  return first ? clip(first, TIULI_SUMMARY_MAX) : "";
}

/**
 * Amenities from a tiuli page: the facility row is explicit; the article's
 * "אין מקלחות, אין חשמל"-style lines are taken only as confirmed ABSENT
 * (see FILL, NEVER OVERWRITE).
 */
function tiuliAmenities(page) {
  const amenities = {};
  if (page.features.includes("ברז מים")) amenities.water = true;
  if (page.features.includes("שירותים")) amenities.toilets = true;
  if (page.features.includes("חיבור לחשמל")) amenities.electricity = true;
  if (/4x4/i.test(page.access)) amenities.fourByFourRequired = true;
  else if (/לכל רכב/.test(page.access)) amenities.fourByFourRequired = false;
  const text = page.article;
  const none = (word) => new RegExp(`(אין|ללא)\\s+(בו |במקום |בחניון )?${word}`).test(text);
  if (none("מקלחות") && amenities.shower === undefined) amenities.shower = false;
  if (none("חשמל") && amenities.electricity === undefined) amenities.electricity = false;
  if (none("(שירותים|מתקני שירותים)") && amenities.toilets === undefined) amenities.toilets = false;
  if (none("(מים|ברז|נקודת מים)") && amenities.water === undefined) amenities.water = false;
  return amenities;
}

/** "85 ₪ לאדם", "החל מ80 ש״ח למבוגר" → 85 / 80; a per-tent price stays in the note. */
function tiuliPrice(text) {
  if (!text) return null;
  const currency = `(?:₪|ש[״"”']?ח|שקלים|שקל)`;
  const match = new RegExp(`(\\d{2,3})\\s*${currency}?\\s*(?:לאדם|למבוגר|לנפש)`).exec(text);
  return match ? Number(match[1]) : null;
}

function applyTiuli(record, page) {
  const changed = [];
  const summary = tiuliSummary(page);
  if (fillDescription(record, summary)) changed.push("description");
  for (const [key, value] of Object.entries(tiuliAmenities(page))) if (setAmenity(record, key, value)) changed.push(key);
  if (!record.pricing.isFree && record.pricing.perNight == null) {
    const perNight = tiuliPrice(page.prices);
    if (perNight != null) {
      record.pricing = { ...record.pricing, perNight };
      changed.push("price");
    }
  }
  if (!record.pricing.note && page.prices) {
    record.pricing = { ...record.pricing, note: clip(page.prices, 300) };
    changed.push("priceNote");
  }
  if (!record.openingHours.note && page.hours && !/^שעות כניסה ויציאה: מתעדכן/.test(page.hours)) {
    record.openingHours = { ...record.openingHours, note: clip(page.hours, 300) };
    changed.push("hours");
  }
  if (!record.directions?.he && page.directions) {
    record.directions = { he: clip(page.directions.replace(/\s*בwaze:.*$/, ""), 500) };
    changed.push("directions");
  }
  if (!record.contact.phone && page.phone) {
    record.contact = { ...record.contact, phone: page.phone };
    changed.push("phone");
  }
  if (!record.photos.some((photo) => !photo.isPlaceholder) && page.image) {
    record.photos = [{ url: page.image, credit: "tiuli.com" }];
    changed.push("photos");
  }
  if (!record.contact.website) {
    record.contact = { ...record.contact, website: page.url };
    changed.push("website");
  }
  if (changed.length && record.source.url !== page.url) addSource(record, "tiuli.com", page.url);
  return changed;
}

// --- Main --------------------------------------------------------------------------------

async function main() {
  if (!args.tiuli) throw new Error("--tiuli=<saved crawl> is required (see USAGE)");
  const dataset = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));
  const records = dataset.campsites;
  const now = new Date().toISOString();
  const tally = {};
  const count = (source, changed) => {
    for (const field of changed) tally[`${source}:${field}`] = (tally[`${source}:${field}`] || 0) + 1;
  };
  const touched = new Set();

  // 1. INPA paid camps: the records imported from the same pages.
  const paid = await wpAll("camping");
  for (const camp of paid) {
    const url = decodeURI(camp.link);
    const record = records.find((r) => r.source.name === "parks.org.il" && decodeURI(r.source.url) === url);
    if (!record) continue;
    const changed = applyPaidCamp(record, camp);
    count("inpa-paid", changed);
    if (changed.length) touched.add(record.id);
  }

  // 2. INPA free camps.
  const free = (await wpAll("free_camping")).map((camp) => ({ wpId: camp.id, ...readFreeCamp(camp) }));
  // Not the paid camps: a free camp can sit right next to one (חורשת
  // הארבעים is 200 m from the paid משמר הכרמל camp) without being it.
  // Nor a business: a Bedouin tent or a tourist village a few hundred
  // metres from a free camp would be marked free and without water.
  const unpaid = records.filter(
    (r) => r.source.name !== "parks.org.il" && (r.kind === "nightCamp" || /חניון/.test(r.name.he))
  );
  const freeNames = new Set(free.map((camp) => core(camp.name)));
  const freeMatches = free
    .map((camp) => ({ camp, name: camp.name, ...matchRecord(unpaid, camp.name, camp.coordinates, freeNames) }))
    .filter((m) => m.record);
  const { kept, dropped } = closestPerRecord(freeMatches);
  for (const { record, camp } of kept) {
    const changed = applyFreeCamp(record, camp);
    count("inpa-free", changed);
    if (changed.length) touched.add(record.id);
  }
  const matchedCamps = new Set(kept.map((m) => m.camp));
  const added = [];
  for (const camp of free) {
    if (matchedCamps.has(camp) || !camp.coordinates) continue;
    // A camp that lost its record to a closer one is a separate site only
    // if it's not right next to it.
    const near = records.find((r) => r.coordinates && distanceKm(r.coordinates, camp.coordinates) < 0.3);
    if (near) continue;
    const record = newFreeCampRecord(camp.wpId, camp, now);
    records.push(record);
    added.push(record.name.he);
  }

  // 3. KKL.
  const kkl = await kklPages();
  for (const page of kkl) {
    const record = records.find((r) => r.id === KKL_PAGES[page.path]);
    if (!record) continue;
    const changed = applyKkl(record, readKkl(page));
    count("kkl", changed);
    if (changed.length) touched.add(record.id);
  }

  // 4. Kinneret beaches.
  for (const page of await kinneretPages()) {
    const slug = decodeURI(page.url).replace(/^.*\/beaches\/|\/$/g, "");
    const record = records.find((r) => r.id === KINNERET_BEACHES[slug]);
    if (!record) continue;
    const changed = applyKinneret(record, readKinneret(page));
    count("kinneret", changed);
    if (changed.length) touched.add(record.id);
  }

  // 5. tiuli.com.
  const pages = JSON.parse(fs.readFileSync(args.tiuli, "utf8")).filter((p) => !p.closed && p.lat != null);
  const tiuliNames = new Set(pages.map((page) => core(page.name)));
  const tiuliMatches = [];
  for (const page of pages) {
    const own = records.find((r) => r.id === `tiuli-${page.id}`);
    if (own) {
      tiuliMatches.push({ record: own, name: own.name.he, km: 0, page });
      continue;
    }
    // tiuli's pages for INPA's own paid camps ("חניון לילה: גן לאומי
    // אכזיב") must not land on the business next door (כפר הנופש אכזיב).
    // Nor may a khan (a paid business) and a free night camp a kilometre
    // apart swap prices and phones (חאן בארותיים / חניון בארותיים).
    const khan = /חאן/.test(page.name);
    const candidates = records.filter(
      (r) =>
        !(/גן לאומי/.test(page.name) && r.kind === "campground") &&
        (khan === /חאן/.test(r.name.he) || (khan && r.kind === "campground"))
    );
    const match = matchRecord(candidates, page.name, { lat: page.lat, lng: page.lng }, tiuliNames, true);
    if (match) tiuliMatches.push({ ...match, name: page.name, page });
  }
  for (const { record, page } of closestPerRecord(tiuliMatches).kept) {
    const changed = applyTiuli(record, page);
    count("tiuli", changed);
    if (changed.length) touched.add(record.id);
  }

  for (const record of records) if (touched.has(record.id)) record.updatedAt = now;

  console.log(`INPA: ${paid.length} paid camps, ${free.length} free camps (${kept.length} matched, ${dropped.length} duplicates of a closer camp)`);
  console.log(`Added ${added.length} free INPA camps the dataset lacked: ${added.join(", ")}`);
  console.log(`tiuli: ${pages.length} open pages, ${tiuliMatches.length} matched`);
  console.log(`Records changed: ${touched.size}`);
  console.table(tally);

  if (args["dry-run"]) return;
  dataset.generatedAt = now;
  fs.writeFileSync(CAMPSITES, JSON.stringify(dataset, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), CAMPSITES)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
