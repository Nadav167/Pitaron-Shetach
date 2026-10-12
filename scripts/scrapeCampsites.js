#!/usr/bin/env node
/**
 * scrapeCampsites.js — builds app/assets/data/campsites.json
 *
 * Scrapes both sources into the single `Campsite` shape defined in
 * app/src/types/campsite.ts:
 *
 *   OFFICIAL    parks.org.il  — Nature and Parks Authority night camping
 *                               grounds (חניוני לילה). isOfficial: true.
 *   NON-OFFICIAL gocamping.co.il — community/private campsite directory.
 *                               isOfficial: false.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCRIPT IS SHAPED THE WAY IT IS
 *
 * The obvious design — "fetch the listing page, read lat/lng off each card" —
 * does not work, because NEITHER SOURCE PUBLISHES COORDINATES.
 *
 *   parks.org.il  has no map embed, no Waze link, no JSON-LD and no lat/lng in
 *                 any ACF field or REST payload. Its detail pages print prose
 *                 directions plus the literal instruction "כתבו בוויז: <name>".
 *                 The map widget on the page is drawn by the government GovMap
 *                 service from an external GIS layer, not from the post.
 *
 *   gocamping.co.il embeds Google Maps as a NAME QUERY
 *                 (maps.google.com/maps?q=<hebrew name>&output=embed), never
 *                 q=<lat>,<lng>. A minority of posts additionally embed
 *                 OpenStreetMap with a real `marker=<lat>,<lng>` — those are
 *                 usable. When OSM geocoding failed, the same widget emits a
 *                 country-sized bbox with NO marker; deriving a centroid from
 *                 that would drop a pin in the middle of the Galilee, so
 *                 bbox-without-marker is rejected outright.
 *
 * So coordinates come from a third step: resolveCoordinates() looks the site up
 * on tiuli.com, whose detail pages each carry a real
 * `https://waze.com/ul?navigate=yes&ll=<lat>,<lng>` link. That one regex is the
 * whole coordinate scraper for that site.
 *
 * Every coordinate is range-checked against Israel's bounding box before it is
 * accepted, and its origin is recorded in `source.coordsSource`. A site whose
 * coordinates cannot be verified ships with `coordinates: null` rather than a
 * guess — this app sends people into deserts at night, and a plausible-looking
 * wrong pin is far worse than a missing one. The app handles null coordinates:
 * such sites are listed but not mapped, and their navigation buttons fall back
 * to a name search.
 * ---------------------------------------------------------------------------
 *
 * USAGE
 *   npm install                      # puppeteer + cheerio, see package.json
 *   node scripts/scrapeCampsites.js
 *
 *   --official-only / --unofficial-only   scrape one source
 *   --no-coords        skip the tiuli coordinate pass (fast, for testing)
 *   --limit=N          only process the first N sites per source
 *   --out=<path>       override the output path
 *   --merge            keep existing verified coordinates from the current
 *                      campsites.json when the scrape can't find better
 *
 * The mapping helpers are exported so the same normalisation can be reused
 * (and unit-tested) without running a scrape.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const OUT_PATH = path.join(__dirname, "..", "app", "assets", "data", "campsites.json");

const SOURCES = {
  official: {
    name: "parks.org.il",
    label: "רשות הטבע והגנים",
    listingUrl:
      "https://www.parks.org.il/%d7%94%d7%96%d7%9e%d7%a0%d7%95%d7%aa-%d7%9c%d7%97%d7%a0%d7%99%d7%95%d7%a0%d7%99-%d7%9c%d7%99%d7%9c%d7%94/",
    isOfficial: true,
  },
  unofficial: {
    name: "gocamping.co.il",
    label: "GoCamping",
    listingUrl:
      "https://www.gocamping.co.il/%d7%90%d7%aa%d7%a8%d7%99-%d7%a7%d7%9e%d7%a4%d7%99%d7%a0%d7%92-%d7%91%d7%99%d7%a9%d7%a8%d7%90%d7%9c/",
    // The archive is two pages; page 1 has no numeric segment.
    pages: ["", "2/"],
    isOfficial: false,
  },
};

/** Israel + the areas it administers, generously padded. Rejects swapped lat/lng. */
const ISRAEL_BOUNDS = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Mapping helpers — pure, no network. Exported at the bottom.
// ---------------------------------------------------------------------------

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function makeId(isOfficial, nameEn, nameHe, index) {
  const prefix = isOfficial ? "inpa" : "gc";
  const slug = slugify(nameEn) || slugify(nameHe) || `site-${index}`;
  return `${prefix}-${slug}`;
}

/** Region labels arrive in several spellings; collapse them onto the union type. */
function normalizeRegion(region) {
  const map = {
    north: "North",
    צפון: "North",
    golan: "Golan",
    גולן: "Golan",
    galilee: "Galilee",
    galil: "Galilee",
    גליל: "Galilee",
    carmel: "Carmel",
    כרמל: "Carmel",
    center: "Center",
    central: "Center",
    מרכז: "Center",
    jerusalem: "Jerusalem",
    ירושלים: "Jerusalem",
    negev: "Negev",
    נגב: "Negev",
    "dead sea": "DeadSea",
    deadsea: "DeadSea",
    "ים המלח": "DeadSea",
    arava: "Arava",
    ערבה: "Arava",
    eilat: "Eilat",
    אילת: "Eilat",
  };
  const key = String(region || "").trim().toLowerCase();
  return map[key] || "North";
}

/**
 * Mirrors app/src/lib/navigation.ts. Kept duplicated on purpose: this script
 * runs in plain Node with no TS build step and no access to the app's path
 * aliases. If you change the URL shapes, change both.
 */
function buildNavigationUrls(coordinates, fallbackQuery) {
  if (coordinates) {
    return {
      waze: `https://waze.com/ul?ll=${coordinates.lat}%2C${coordinates.lng}&navigate=yes&zoom=17`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat}%2C${coordinates.lng}&travelmode=driving`,
    };
  }
  const q = encodeURIComponent(fallbackQuery || "");
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

function isInIsrael(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= ISRAEL_BOUNDS.minLat &&
    lat <= ISRAEL_BOUNDS.maxLat &&
    lng >= ISRAEL_BOUNDS.minLng &&
    lng <= ISRAEL_BOUNDS.maxLng
  );
}

/**
 * Accepts a coordinate pair only if it lands inside Israel. Some sources
 * (amudanan.co.il) print longitude first, so a swapped pair is retried once
 * rather than discarded.
 */
function normalizeCoordinates(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (isInIsrael(x, y)) return { lat: round7(x), lng: round7(y) };
  if (isInIsrael(y, x)) return { lat: round7(y), lng: round7(x) };
  return null;
}

function round7(n) {
  return Math.round(n * 1e7) / 1e7;
}

/** gocamping reuses a handful of stock images captioned "תמונה להמחשה". */
function isPlaceholderPhoto(url) {
  if (!url) return false;
  return /\/uploads\/2018\/07\/(tent|camping)-\d+_1920\.(jpg|jpeg|png)$/i.test(url);
}

/** Hebrew filenames appear unencoded in src attributes and 404 unless encoded. */
function encodeImageUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => (/%[0-9a-f]{2}/i.test(seg) ? seg : encodeURIComponent(seg)))
      .join("/");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * The one place a raw scraped record becomes a `Campsite`. Anything the source
 * didn't state stays absent rather than being defaulted to a plausible value —
 * `amenities: {}` means "unknown", not "this site has nothing".
 */
function toCampsite(raw, options) {
  const { isOfficial, sourceName, scrapedAt, index = 0 } = options;

  const coordinates =
    raw.lat != null && raw.lng != null ? normalizeCoordinates(raw.lat, raw.lng) : null;

  const nameHe = String(raw.nameHe || "").trim();
  const nameEn = String(raw.nameEn || nameHe).trim();

  const perNight =
    raw.pricePerNight === null || raw.pricePerNight === undefined
      ? null
      : Number(raw.pricePerNight);

  const openingHours = {};
  if (raw.openingHoursNote) openingHours.note = String(raw.openingHoursNote).trim();
  if (raw.checkIn) openingHours.checkIn = String(raw.checkIn).trim();
  if (raw.checkOut) openingHours.checkOut = String(raw.checkOut).trim();

  const contact = {};
  if (raw.phone) contact.phone = String(raw.phone).trim();
  if (raw.website) contact.website = raw.website;
  else if (raw.detailUrl) contact.website = raw.detailUrl;
  if (raw.email) contact.email = raw.email;

  const photos = [];
  if (raw.photoUrl) {
    const url = encodeImageUrl(raw.photoUrl);
    const placeholder =
      raw.photoIsPlaceholder !== undefined ? !!raw.photoIsPlaceholder : isPlaceholderPhoto(url);
    photos.push(placeholder ? { url, isPlaceholder: true } : { url });
  }

  const source = { name: sourceName };
  if (raw.detailUrl) source.url = raw.detailUrl;
  if (raw.coordsSource) source.coordsSource = raw.coordsSource;
  if (scrapedAt) source.scrapedAt = scrapedAt;
  // Flag anything a human should eyeball: no coordinates at all, sources that
  // disagreed, or a pin that describes the venue rather than the pitch.
  if (raw.needsReview || !coordinates) source.needsReview = true;

  const campsite = {
    id: raw.id || makeId(isOfficial, nameEn, nameHe, index),
    name: { he: nameHe, en: nameEn },
    coordinates,
    isOfficial,
    region: normalizeRegion(raw.region),
    pricing: {
      perNight,
      currency: "ILS",
      isFree: perNight === 0,
      ...(isOfficial
        ? { note: "מחיר לינת שטח באוהל פרטי, מבוגר. תעריפי ילד/חייל/בקתה שונים." }
        : {}),
    },
    openingHours,
    navigationUrls: buildNavigationUrls(coordinates, nameHe || nameEn),
    amenities: raw.amenities || {},
    photos,
    contact,
    source,
    updatedAt: scrapedAt || new Date().toISOString(),
  };

  if (raw.descriptionHe || raw.descriptionEn) {
    campsite.description = {};
    if (raw.descriptionHe) campsite.description.he = raw.descriptionHe;
    if (raw.descriptionEn) campsite.description.en = raw.descriptionEn;
  }
  if (raw.address) campsite.address = raw.address;
  if (raw.rating != null) campsite.rating = Number(raw.rating);

  return campsite;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Strips the generic words both directories prepend, so names can be compared. */
function nameKey(name) {
  return String(name)
    .replace(/חניון לילה|קמפינג|חניון|גן לאומי|שמורת טבע|חוות|חאן/g, "")
    .replace(/[()\-–—,'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The same physical place is listed by both directories (Horshat Tal is the
 * clearest case). Rather than showing it twice — once "official" and once
 * "non-official", which is exactly the distinction the app is trying to make
 * legible — collapse near-duplicates onto the official record and fold in
 * anything extra the unofficial listing had (photos, a phone number).
 */
function dedupe(campsites, { radiusMeters = 500 } = {}) {
  const kept = [];
  const merged = [];

  const sorted = [...campsites].sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial));

  for (const campsite of sorted) {
    const duplicate = kept.find((existing) => {
      if (existing.isOfficial === campsite.isOfficial) return false;
      const sameName =
        nameKey(existing.name.he) === nameKey(campsite.name.he) ||
        (nameKey(existing.name.he) &&
          nameKey(campsite.name.he) &&
          (nameKey(existing.name.he).includes(nameKey(campsite.name.he)) ||
            nameKey(campsite.name.he).includes(nameKey(existing.name.he))));
      if (!sameName) return false;
      if (!existing.coordinates || !campsite.coordinates) return true;
      return haversineMeters(existing.coordinates, campsite.coordinates) <= radiusMeters;
    });

    if (!duplicate) {
      kept.push(campsite);
      continue;
    }

    for (const photo of campsite.photos) {
      if (!duplicate.photos.some((p) => p.url === photo.url)) duplicate.photos.push(photo);
    }
    if (!duplicate.contact.phone && campsite.contact.phone) {
      duplicate.contact.phone = campsite.contact.phone;
    }
    duplicate.source.alsoListedOn = campsite.source.url || campsite.source.name;
    merged.push({ kept: duplicate.id, dropped: campsite.id });
  }

  return { campsites: kept, merged };
}

function buildDataset(officialRaw, unofficialRaw, scrapedAt) {
  const stamp = scrapedAt || new Date().toISOString();

  const official = officialRaw.map((raw, index) =>
    toCampsite(raw, {
      isOfficial: true,
      sourceName: SOURCES.official.name,
      scrapedAt: stamp,
      index,
    })
  );
  const unofficial = unofficialRaw.map((raw, index) =>
    toCampsite(raw, {
      isOfficial: false,
      sourceName: SOURCES.unofficial.name,
      scrapedAt: stamp,
      index,
    })
  );

  const { campsites, merged } = dedupe([...official, ...unofficial]);

  campsites.sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
    return a.name.he.localeCompare(b.name.he, "he");
  });

  return {
    dataset: {
      generatedAt: stamp,
      sources: [
        {
          name: SOURCES.official.name,
          url: SOURCES.official.listingUrl,
          isOfficial: true,
          count: campsites.filter((c) => c.isOfficial).length,
        },
        {
          name: SOURCES.unofficial.name,
          url: SOURCES.unofficial.listingUrl,
          isOfficial: false,
          count: campsites.filter((c) => !c.isOfficial).length,
        },
      ],
      campsites,
    },
    merged,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require("puppeteer");
    browserPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * Both sites are server-rendered WordPress, so plain fetch + Cheerio is enough
 * and is tried first. Puppeteer is the fallback for anything that turns out to
 * need JS (and for pages behind bot checks, which plain fetch trips more often).
 */
async function fetchHtml(url, { force = false } = {}) {
  if (!force) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "he,en;q=0.8" },
      });
      if (res.ok) {
        const html = await res.text();
        if (html && html.length > 500) return html;
      }
    } catch {
      /* fall through to puppeteer */
    }
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    return await page.content();
  } finally {
    await page.close();
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function stripHtml(html) {
  if (!html) return "";
  const cheerio = require("cheerio");
  return cheerio.load(`<div>${html}</div>`)("div").text().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Coordinate extraction
// ---------------------------------------------------------------------------

/**
 * Pulls a coordinate out of raw page HTML, trying the patterns that actually
 * occur on these sites, most-trustworthy first. Returns { lat, lng, via } or
 * null. Deliberately does NOT fall back to an OSM bbox centroid: when OSM
 * geocoding fails, gocamping emits a bbox spanning the entire country.
 */
function extractCoordsFromHtml(html) {
  if (!html) return null;

  const patterns = [
    // waze.com/ul?...ll=31.2345,35.6789 — the tiuli pattern, a real pin.
    { re: /waze\.com\/ul[^"'\s]*[?&]ll=(-?\d+\.\d+)[,%2C]+\s*(-?\d+\.\d+)/i, via: "Waze deep link" },
    // OpenStreetMap embed with an actual marker (not a bare bbox).
    { re: /openstreetmap\.org\/export\/embed\.html[^"'\s]*[?&]marker=(-?\d+\.\d+)[,%2C]+\s*(-?\d+\.\d+)/i, via: "OpenStreetMap marker" },
    { re: /openstreetmap\.org\/\?mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/i, via: "OpenStreetMap mlat/mlon" },
    // Google Maps place embeds encode the pin as !3d<lat>!4d<lng>.
    { re: /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, via: "Google Maps embed pin" },
    // maps?q=<lat>,<lng> — only when q is numeric; a name query is useless.
    { re: /maps[^"'\s]*[?&]q=(-?\d+\.\d+)[,%2C]+\s*(-?\d+\.\d+)/i, via: "Google Maps q= coordinates" },
    // JSON-LD / inline JSON.
    { re: /"latitude"\s*:\s*"?(-?\d+\.\d+)"?\s*,\s*"longitude"\s*:\s*"?(-?\d+\.\d+)"?/i, via: "JSON-LD geo" },
    { re: /data-lat=["'](-?\d+\.\d+)["'][^>]*data-lng=["'](-?\d+\.\d+)["']/i, via: "data-lat/data-lng" },
  ];

  for (const { re, via } of patterns) {
    const match = html.match(re);
    if (!match) continue;
    const coords = normalizeCoordinates(match[1], match[2]);
    if (coords) return { ...coords, via };
  }
  return null;
}

/**
 * Neither source has coordinates, so look the site up on tiuli.com, which
 * carries a Waze deep link on every camping / lodging / attraction page.
 * Returns null rather than a nearby-sounding guess when nothing matches.
 */
async function resolveCoordinates(nameHe) {
  const query = encodeURIComponent(nameHe.replace(/^(קמפינג|חניון לילה)\s*/, "").trim());
  const searchUrl = `https://www.tiuli.com/search?q=${query}`;

  try {
    const searchHtml = await fetchHtml(searchUrl);
    const cheerio = require("cheerio");
    const $ = cheerio.load(searchHtml);

    const candidates = [];
    $("a[href*='/camping/'], a[href*='/lodgings/'], a[href*='/attractions/'], a[href*='/points-of-interest/']").each(
      (_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const absolute = href.startsWith("http") ? href : `https://www.tiuli.com${href}`;
        if (!candidates.includes(absolute)) candidates.push(absolute);
      }
    );

    for (const candidate of candidates.slice(0, 3)) {
      const html = await fetchHtml(candidate);
      const coords = extractCoordsFromHtml(html);
      if (coords) {
        return { ...coords, source: `tiuli.com ${coords.via} (${candidate})` };
      }
    }
  } catch (error) {
    console.warn(`  ! coordinate lookup failed for "${nameHe}": ${error.message}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// parks.org.il (official)
// ---------------------------------------------------------------------------

/**
 * The listing is not free-form HTML: the page's `content.rendered` is empty and
 * the site tiles come from an ACF repeater. Reading it through the WP REST API
 * is both easier and more stable than guessing theme class names, so that is
 * the primary path; DOM scraping is the fallback.
 */
async function scrapeOfficialListing() {
  const slug = SOURCES.official.listingUrl.replace(/\/$/, "").split("/").pop();

  try {
    const pages = await fetchJson(
      `https://www.parks.org.il/wp-json/wp/v2/pages?slug=${slug}&_fields=id,slug,link,acf`
    );
    const repeater = pages?.[0]?.acf?.team_repeater;
    if (Array.isArray(repeater) && repeater.length) {
      return repeater
        .map((row) => ({
          nameHe: stripHtml(row.title),
          detailUrl: row.link_to_more_information,
          photoUrl: row.image?.url || row.image?.sizes?.large,
          summary: stripHtml(row.content),
        }))
        .filter((row) => row.detailUrl);
    }
    console.warn("  ! ACF team_repeater empty, falling back to DOM scrape");
  } catch (error) {
    console.warn(`  ! parks.org.il REST failed (${error.message}), falling back to DOM scrape`);
  }

  const html = await fetchHtml(SOURCES.official.listingUrl);
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);
  const seen = new Set();
  const rows = [];

  $("a[href*='/camping/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Slugs are percent-encoded Hebrew and the site emits mixed case for the
    // same URL, so normalise before deduping or every site is counted twice.
    const key = decodeURIComponent(href).replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const nameHe = $(el).text().trim() || $(el).find("img").attr("alt") || "";
    rows.push({ nameHe, detailUrl: href.startsWith("http") ? href : `https://www.parks.org.il${href}` });
  });

  return rows;
}

async function scrapeOfficialDetail(row) {
  const html = await fetchHtml(row.detailUrl);
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const nameHe =
    row.nameHe || $("h1").first().text().trim() || $("meta[property='og:title']").attr("content") || "";

  const photoUrl =
    row.photoUrl ||
    $("meta[property='og:image']").attr("content") ||
    $("img[src*='static.parks.org.il']").first().attr("src");

  const bodyText = $("body").text().replace(/\s+/g, " ");

  // Gate hours are printed as prose; capture the sentence rather than trying to
  // parse a schedule that isn't structured in the first place.
  const hoursMatch = bodyText.match(/הכניסה לחניון הלילה[^.]{0,160}/);
  const phoneMatch = bodyText.match(/(\*\d{4}|0\d{1,2}-?\d{7}|0\d{2}-?\d{3}-?\d{4})/);
  const priceMatch = bodyText.match(/לינת שטח[^₪\d]{0,40}(\d{2,3})/) || bodyText.match(/₪\s?(\d{2,3})/);

  return {
    nameHe,
    nameEn: "",
    detailUrl: row.detailUrl,
    photoUrl,
    openingHoursNote: hoursMatch ? hoursMatch[0].trim() : undefined,
    phone: phoneMatch ? phoneMatch[0] : undefined,
    pricePerNight: priceMatch ? Number(priceMatch[1]) : null,
    region: guessRegionFromText(bodyText),
    descriptionHe: row.summary || $("meta[name='description']").attr("content") || undefined,
    // parks.org.il carries no coordinates at all — see the header comment.
    lat: null,
    lng: null,
  };
}

/** Coarse region guess from place names in the page text; overridden by data. */
function guessRegionFromText(text) {
  const rules = [
    [/גולן|קצרין|יהודיה/, "Golan"],
    [/כרמל|חיפה/, "Carmel"],
    [/גליל|חרמון|דן|חולה|צפת/, "Galilee"],
    [/ים המלח|מצדה|עין גדי/, "DeadSea"],
    [/ערבה|יוטבתה|חי-בר/, "Arava"],
    [/אילת/, "Eilat"],
    [/נגב|רמון|מצפה|ערד|ממשית|באר שבע/, "Negev"],
    [/ירושלים|הרי יהודה|קסטל/, "Jerusalem"],
    [/תל אביב|מרכז|ירקון|אשקלון|אשדוד/, "Center"],
  ];
  for (const [re, region] of rules) if (re.test(text)) return region;
  return "North";
}

// ---------------------------------------------------------------------------
// gocamping.co.il (non-official)
// ---------------------------------------------------------------------------

async function scrapeUnofficialListing() {
  const cheerio = require("cheerio");
  const rows = [];
  const seen = new Set();

  for (const suffix of SOURCES.unofficial.pages) {
    const url = `${SOURCES.unofficial.listingUrl}${suffix}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Elementor loop: each entry is an <h3> wrapping the permalink. Anchors
    // inside headings are targeted rather than `article.post`, which this
    // theme does not emit.
    $("h3 a[href], h2 a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const nameHe = $(el).text().trim();
      if (!href || !nameHe) return;
      if (!href.includes("gocamping.co.il")) return;
      if (/\/\d+\/?$/.test(href)) return; // pagination links
      const key = decodeURIComponent(href).replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ nameHe, detailUrl: href });
    });
  }

  return rows;
}

async function scrapeUnofficialDetail(row) {
  const html = await fetchHtml(row.detailUrl);
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const nameHe = row.nameHe || $("h1").first().text().trim();

  // og:image is reliably the hero here; inline gallery images are lazy-loaded
  // and serve an SVG data-URI placeholder in src.
  const photoUrl =
    $("meta[property='og:image']").attr("content") ||
    $("img[src*='/wp-content/uploads/']").first().attr("src") ||
    $("img[data-src*='/wp-content/uploads/']").first().attr("data-src");

  const bodyText = $("body").text().replace(/\s+/g, " ");
  const priceMatch = bodyText.match(/(\d{2,4})\s?(₪|ש"ח|שח)\s?(ללילה|לאדם|לילה)/);
  const phoneMatch = bodyText.match(/(0\d{1,2}-?\d{7}|0\d{2}-?\d{3}-?\d{4}|\*\d{4}|1-800-\d{3}-\d{3})/);
  const hoursMatch = bodyText.match(/(צ'ק אין|כניסה לקמפינג)[^.]{0,120}/);
  const closedMatch = bodyText.match(/(סגור זמנית|סגור עד הודעה חדשה)/);

  // Some posts embed OSM with a real marker — the only on-site coordinate.
  const onPageCoords = extractCoordsFromHtml(html);

  return {
    nameHe,
    nameEn: "",
    detailUrl: row.detailUrl,
    photoUrl,
    photoIsPlaceholder: isPlaceholderPhoto(photoUrl),
    pricePerNight: priceMatch ? Number(priceMatch[1]) : null,
    phone: phoneMatch ? phoneMatch[0] : undefined,
    openingHoursNote: closedMatch
      ? closedMatch[0]
      : hoursMatch
      ? hoursMatch[0].trim()
      : undefined,
    region: guessRegionFromText(bodyText),
    descriptionHe: $("meta[name='description']").attr("content") || undefined,
    lat: onPageCoords ? onPageCoords.lat : null,
    lng: onPageCoords ? onPageCoords.lng : null,
    coordsSource: onPageCoords ? `gocamping.co.il ${onPageCoords.via}` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { limit: Infinity, coords: true, out: OUT_PATH, merge: false, only: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--official-only") args.only = "official";
    else if (arg === "--unofficial-only") args.only = "unofficial";
    else if (arg === "--no-coords") args.coords = false;
    else if (arg === "--merge") args.merge = true;
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]);
    else if (arg.startsWith("--out=")) args.out = path.resolve(arg.split("=")[1]);
  }
  return args;
}

function loadExisting(outPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const byId = new Map();
    for (const campsite of parsed.campsites || []) byId.set(campsite.id, campsite);
    return byId;
  } catch {
    return new Map();
  }
}

async function scrapeSource(key, args) {
  const source = SOURCES[key];
  console.log(`\n→ ${source.name}`);

  const listing =
    key === "official" ? await scrapeOfficialListing() : await scrapeUnofficialListing();
  console.log(`  found ${listing.length} listings`);

  const rows = [];
  for (const [index, row] of listing.slice(0, args.limit).entries()) {
    try {
      const detail =
        key === "official"
          ? await scrapeOfficialDetail(row)
          : await scrapeUnofficialDetail(row);

      if (args.coords && detail.lat == null) {
        const resolved = await resolveCoordinates(detail.nameHe);
        if (resolved) {
          detail.lat = resolved.lat;
          detail.lng = resolved.lng;
          detail.coordsSource = resolved.source;
        } else {
          detail.coordsSource = "No coordinate found — left null deliberately";
        }
      }

      rows.push(detail);
      const pin = detail.lat != null ? `${detail.lat},${detail.lng}` : "no coordinates";
      console.log(`  [${index + 1}/${listing.length}] ${detail.nameHe} — ${pin}`);
    } catch (error) {
      console.warn(`  ! failed on ${row.detailUrl}: ${error.message}`);
    }
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  const scrapedAt = new Date().toISOString();

  let official = [];
  let unofficial = [];

  try {
    if (args.only !== "unofficial") official = await scrapeSource("official", args);
    if (args.only !== "official") unofficial = await scrapeSource("unofficial", args);
  } finally {
    await closeBrowser();
  }

  // --merge keeps coordinates a previous run (or a human) verified, so a
  // scrape that comes back empty-handed never downgrades good data to null.
  if (args.merge) {
    const existing = loadExisting(args.out);
    for (const list of [official, unofficial]) {
      for (const row of list) {
        if (row.lat != null) continue;
        const id = makeId(list === official, row.nameEn || row.nameHe, row.nameHe, 0);
        const previous = existing.get(id);
        if (previous?.coordinates) {
          row.lat = previous.coordinates.lat;
          row.lng = previous.coordinates.lng;
          row.coordsSource = previous.source?.coordsSource || "carried over from previous run";
        }
      }
    }
  }

  const { dataset, merged } = buildDataset(official, unofficial, scrapedAt);

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  const withCoords = dataset.campsites.filter((c) => c.coordinates).length;
  const needsReview = dataset.campsites.filter((c) => c.source.needsReview).length;

  console.log(`\n✓ wrote ${dataset.campsites.length} campsites → ${args.out}`);
  console.log(`  official: ${dataset.campsites.filter((c) => c.isOfficial).length}`);
  console.log(`  non-official: ${dataset.campsites.filter((c) => !c.isOfficial).length}`);
  console.log(`  with coordinates: ${withCoords}/${dataset.campsites.length}`);
  console.log(`  flagged for review: ${needsReview}`);
  if (merged.length) {
    console.log(`  merged duplicates: ${merged.map((m) => `${m.dropped}→${m.kept}`).join(", ")}`);
  }
}

module.exports = {
  buildDataset,
  toCampsite,
  dedupe,
  buildNavigationUrls,
  normalizeCoordinates,
  normalizeRegion,
  extractCoordsFromHtml,
  isPlaceholderPhoto,
  haversineMeters,
  makeId,
  SOURCES,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
