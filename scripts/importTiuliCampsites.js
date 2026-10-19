#!/usr/bin/env node
/**
 * importTiuliCampsites.js — adds the campsites and night camps listed on
 * tiuli.com that the dataset doesn't have yet, and gives photo-less
 * records the photo tiuli has for the same site.
 *
 * ---------------------------------------------------------------------------
 * WHY A SECOND SOURCE
 *
 * The OpenStreetMap import (importOsmCampsites.js) only finds what mappers
 * tagged tourism=camp_site. Plenty of well-known sites aren't tagged that
 * way, or aren't mapped at all: Timna Park's campground, most Kinneret
 * beaches, many KKL forest camps and desert khans. tiuli.com's camping
 * directory (~350 pages, ids ~180-610) has them, and every page carries a
 * Waze link with the site's coordinates, a photo, and often hours, prices
 * and a phone number.
 *
 * WHAT IT DOES
 *   1. Crawls https://www.tiuli.com/camping/<id> for ids 1..MAX_ID (or reads
 *      a saved crawl, --from=tiuli.json; --save=tiuli.json keeps one).
 *   2. Drops closed businesses, rentals and glamping without a location
 *      (see SKIP), and anything outside the map (same mask as the map).
 *   3. A page within DUPLICATE_KM of an existing record (or DUPLICATE_NAMED_KM
 *      with a shared name word) is that record: nothing new is added, but if
 *      the record has no real photo, tiuli's photo is added to it.
 *   4. Everything else becomes a new record, id `tiuli-<page id>`.
 *
 * English names come from scripts/data/tiuliNameTranslations.json (hand
 * translations); a missing one is listed in scripts/data/untranslated.json
 * and the Hebrew name is used meanwhile.
 *
 * USAGE
 *   node scripts/importTiuliCampsites.js [--from=tiuli.json] [--save=tiuli.json] [--dry-run]
 *   Always run it after importOsmCampsites.js (OSM wins a tie; this drops
 *   tiuli records an OSM site now covers), then rebuild nearby places.
 * ---------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const {
  ROOT,
  CAMPSITES,
  distanceKm,
  makeIsraelTest,
  regionFor,
  navigationUrls,
  HEBREW,
  sharesWord,
  parseArgs,
} = require("./lib/importHelpers");

const TRANSLATIONS = path.join(__dirname, "data/tiuliNameTranslations.json");
const UNTRANSLATED = path.join(__dirname, "data/untranslated.json");
const MAX_ID = 720;
const DUPLICATE_KM = 0.7;
const DUPLICATE_NAMED_KM = 2;
// tiuli blocks the default fetch user agent.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DEFAULT_IMAGE = /default_share_image/;

/**
 * Pages that aren't a place to camp: closed businesses, a caravan rental
 * company, glamping "at secret locations", zimmer-style suites.
 */
const SKIP = /אינו פעיל|נסגר|השכרת|מיקומים סודיים|צימר|סוויטה/;

const args = parseArgs();

// --- Crawl ------------------------------------------------------------------------

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The page's info boxes: an orange heading ("שעות פתיחה", "מחירים",
 * "איך מגיעים"...) followed by a `ugc` block of text. Most free night camps
 * have none; businesses usually fill in hours and prices.
 */
function sections(html) {
  const found = {};
  const re = /text-orange-600 block[^>]*>([^<]+)<\/span>[\s\S]*?<div class="ugc[^"]*">([\s\S]*?)<\/div>/g;
  for (let match = re.exec(html); match; match = re.exec(html)) {
    found[decode(match[1])] = decode(match[2].replace(/<br\s*\/?>|<\/p>/g, " ").replace(/<[^>]+>/g, " "));
  }
  return found;
}

function parsePage(id, url, html) {
  const ll = /ll=(-?[0-9.]+)(?:,|%2C)(-?[0-9.]+)/.exec(html);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const image = (/og:image" content="([^"]*)/.exec(html) || [])[1] || null;
  const phone = (/href="tel:([^"]+)"/.exec(html) || [])[1] || null;
  const info = sections(html);
  const about = Object.entries(info).find(([heading]) => /^(על |אודות|תיאור)/.test(heading));
  return {
    id,
    url,
    name: decode((h1 ? h1[1] : "").replace(/<[^>]+>/g, " ")),
    lat: ll ? Number(ll[1]) : null,
    lng: ll ? Number(ll[2]) : null,
    image: image && !DEFAULT_IMAGE.test(image) ? image : null,
    hours: info["שעות פתיחה"] || "",
    prices: info["מחירים"] || "",
    address: (/כתובת:\s*([^]+)/.exec(info["איך מגיעים"] || "") || [])[1]?.trim() || "",
    description: about ? about[1] : "",
    phone,
    closed: /החניון אינו פעיל|העסק אינו פעיל|סגור עד להודעה חדשה/.test(html),
  };
}

async function crawl() {
  const pages = [];
  const queue = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`https://www.tiuli.com/camping/${id}`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(40_000),
          });
          if (response.status === 404) break;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          pages.push(parsePage(id, response.url, await response.text()));
          break;
        } catch (error) {
          if (attempt === 2) console.warn(`  page ${id}: ${error.message}`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      await new Promise((r) => setTimeout(r, 300)); // be gentle: ~6 pages/s at most
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return pages.sort((a, b) => a.id - b.id);
}

// --- Mapping a page to a Campsite record ---------------------------------------------

/** "קמפינג אלרום: חווית לינה בגולן" → "קמפינג אלרום". Marketing subtitles go. */
function cleanName(name) {
  return name.split(/:\s/)[0].replace(/\s+[-–]\s+(חווי|לינה|אירוח|הכי|נופש|קמפינג ש).*$/, "").trim();
}

/**
 * `perNight` means one adult in their own tent, so only a price stated per
 * person is taken ("85 ₪ לאדם ללילה", "החל מ80 ש״ח למבוגר"); a price per
 * tent or per bungalow stays in the note only.
 */
function priceFrom(text) {
  if (!text) return { perNight: null, isFree: false };
  const currency = `(?:₪|ש[״"”']?ח|שקלים|שקל)`;
  if (/ללא תשלום|חינם|ללא עלות/.test(text) && !new RegExp(currency).test(text)) return { perNight: 0, isFree: true };
  const match = new RegExp(`(\\d{2,3})\\s*${currency}?\\s*(?:לאדם|למבוגר|לנפש)`).exec(text);
  return { perNight: match ? Number(match[1]) : null, isFree: false };
}

function toCampsite(page, translations, now) {
  const he = cleanName(page.name);
  const coordinates = { lat: Math.round(page.lat * 1e5) / 1e5, lng: Math.round(page.lng * 1e5) / 1e5 };
  const price = priceFrom(page.prices);
  // Free natural sites have neither a booking phone nor a price list.
  const kind = /חניון/.test(he) || (!page.phone && !page.prices) ? "nightCamp" : "campground";
  return {
    id: `tiuli-${page.id}`,
    name: { he, en: translations[he] || he },
    ...(page.description ? { description: { he: page.description.slice(0, 600) } } : {}),
    coordinates,
    isOfficial: false,
    kind,
    region: regionFor(coordinates),
    ...(page.address ? { address: page.address } : {}),
    pricing: {
      perNight: price.perNight,
      currency: "ILS",
      isFree: price.isFree,
      ...(page.prices ? { note: page.prices.slice(0, 300) } : {}),
    },
    openingHours: page.hours ? { note: page.hours.slice(0, 300) } : {},
    navigationUrls: navigationUrls(coordinates),
    amenities: {},
    photos: page.image ? [{ url: page.image, credit: "tiuli.com" }] : [],
    contact: { ...(page.phone ? { phone: page.phone } : {}), website: page.url },
    source: {
      name: "tiuli.com",
      url: page.url,
      coordsSource: "tiuli.com Waze deep-link",
      scrapedAt: now,
    },
    updatedAt: now,
  };
}

// --- Main ---------------------------------------------------------------------------

async function main() {
  const now = new Date().toISOString();
  const dataset = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));
  const translations = fs.existsSync(TRANSLATIONS) ? JSON.parse(fs.readFileSync(TRANSLATIONS, "utf8")) : {};
  const inIsrael = makeIsraelTest();

  let pages;
  if (typeof args.from === "string") pages = JSON.parse(fs.readFileSync(args.from, "utf8"));
  else {
    console.log("Crawling tiuli.com camping pages...");
    pages = await crawl();
  }
  if (typeof args.save === "string") fs.writeFileSync(args.save, JSON.stringify(pages, null, 1));
  console.log(`  ${pages.length} pages`);

  // Re-runs rebuild the tiuli records; tiuli photos added to other records are re-derived too.
  const existing = dataset.campsites
    .filter((c) => !c.id.startsWith("tiuli-"))
    .map((c) => ({ ...c, photos: c.photos.filter((p) => p.credit !== "tiuli.com") }));

  const added = [];
  let skipped = 0;
  let matched = 0;
  let photosAdded = 0;
  for (const page of pages) {
    if (page.lat === null || page.closed || SKIP.test(page.name) || !inIsrael(page)) {
      skipped++;
      continue;
    }
    const record = toCampsite(page, translations, now);
    const same = (other) => {
      if (!other.coordinates) return false;
      const km = distanceKm(other.coordinates, record.coordinates);
      return km < DUPLICATE_KM || (km < DUPLICATE_NAMED_KM && sharesWord(other.name.he, record.name.he));
    };
    const twin = existing.find(same) || added.find(same);
    if (twin) {
      matched++;
      if (page.image && !twin.photos.some((p) => !p.isPlaceholder)) {
        twin.photos.push({ url: page.image, credit: "tiuli.com" });
        photosAdded++;
      }
      continue;
    }
    added.push(record);
  }
  console.log(
    `  ${skipped} skipped (closed / not a campsite / no location), ${matched} already listed (${photosAdded} got tiuli's photo), ${added.length} new`
  );

  const untranslated = added.filter((r) => r.name.en === r.name.he && HEBREW.test(r.name.he)).map((r) => r.name.he);
  if (untranslated.length) {
    fs.writeFileSync(UNTRANSLATED, JSON.stringify(untranslated, null, 1) + "\n");
    console.warn(`  ${untranslated.length} names have no English; listed in ${path.relative(ROOT, UNTRANSLATED)}`);
  } else if (fs.existsSync(UNTRANSLATED)) fs.unlinkSync(UNTRANSLATED);

  const byRegion = {};
  for (const r of added) byRegion[r.region] = (byRegion[r.region] ?? 0) + 1;
  console.log("  new sites by region:", byRegion);
  console.log(`  kinds: ${added.filter((r) => r.kind === "nightCamp").length} night camps, ${added.filter((r) => r.kind === "campground").length} campgrounds`);

  if (args["dry-run"]) return console.log("Dry run, nothing written.");
  const sources = dataset.sources.filter((s) => s.name !== "tiuli.com");
  sources.push({ name: "tiuli.com", url: "https://www.tiuli.com/camping", isOfficial: false, count: added.length });
  const out = { generatedAt: now, sources, campsites: [...existing, ...added] };
  fs.writeFileSync(CAMPSITES, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${out.campsites.length} campsites to ${path.relative(ROOT, CAMPSITES)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
