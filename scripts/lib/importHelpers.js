/**
 * Helpers shared by the campsite importers (importOsmCampsites.js,
 * importTiuliCampsites.js), so both decide "is this in Israel", "which
 * region" and "is this the same site" the same way.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const CAMPSITES = path.join(ROOT, "app/assets/data/campsites.json");
const MASK = path.join(ROOT, "app/assets/data/mapMask.json");

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

/**
 * True for a point the map shows: inside the map window and outside the
 * areas it erases (app/assets/data/mapMask.json: neighbouring countries,
 * Gaza). So "Israel" means Israel, the Golan and the West Bank (Nadav,
 * 2026-10-13).
 */
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
  if (lat < 29.86) return "Eilat"; // Eilat mountains up to Timna
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

/** Mirrors app/src/lib/navigation.ts (see the note in scrapeCampsites.js). */
function navigationUrls({ lat, lng }) {
  return {
    waze: `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=17`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=driving`,
  };
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

/** Command-line flags: --key=value or --flag. */
function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.length ? rest.join("=") : true];
    })
  );
}

module.exports = {
  ROOT,
  CAMPSITES,
  distanceKm,
  makeIsraelTest,
  regionFor,
  navigationUrls,
  HEBREW,
  words,
  sharesWord,
  parseArgs,
};
