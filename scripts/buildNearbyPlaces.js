#!/usr/bin/env node
/**
 * buildNearbyPlaces.js — builds app/backend/data/nearbyPlaces.json
 *
 * For every campsite in app/assets/data/campsites.json that has coordinates,
 * collects the named places within RADIUS_KM (restaurants, cafes,
 * attractions, springs, beaches, supermarkets, fuel...) from OpenStreetMap.
 * The travel agent's find_nearby_places tool reads the result.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE DATA COMES FROM, AND WHY
 *
 * Geofabrik's daily OpenStreetMap extract for Israel, in its "free"
 * shapefile form, read directly by this script (the shapefile/DBF reader is
 * below; no dependencies).
 *
 * The obvious source, the public Overpass API, was tried first and dropped:
 * in Oct 2026 its servers failed nearly every request (overpass-api.de 406,
 * the mirrors 500 or timeouts), and they throttle cloud IPs such as
 * Vercel's. A downloaded extract can't fail like that, and since the agent
 * only plans around the app's own campsites, the places it needs are known
 * in advance and can ship as a small file.
 *
 * Layers used (fclass = Geofabrik's place class):
 *   gis_osm_pois_free_1     points: restaurants, cafes, attractions, ...
 *   gis_osm_pois_a_free_1   the same classes mapped as areas (center used)
 *   gis_osm_natural_free_1  peaks, springs, caves, beaches
 *   gis_osm_natural_a_free_1  areas of the same (beaches)
 *   gis_osm_traffic_free_1  fuel stations, waterfalls
 * Only named features are kept: the agent can't recommend "a restaurant".
 * The free extract has names but no opening hours, websites or cuisine.
 * ---------------------------------------------------------------------------
 *
 * USAGE (re-run after the campsite list changes, or every few months)
 *   1. Download https://download.geofabrik.de/asia/israel-and-palestine-latest-free.shp.zip
 *      (~210 MB) and unzip it to a folder outside the repo.
 *   2. node scripts/buildNearbyPlaces.js --shp=<that folder>
 *
 * Data © OpenStreetMap contributors, ODbL. The app credits it on the
 * itinerary page and in the PDF.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CAMPSITES = path.join(ROOT, "app/assets/data/campsites.json");
const OUT = path.join(ROOT, "app/backend/data/nearbyPlaces.json");

const RADIUS_KM = 20;
const MAX_PER_CATEGORY = 15;

/** Agent category → Geofabrik fclass values. Keep in sync with PLACE_CATEGORIES in app/backend/agent/places.ts. */
const CATEGORIES = {
  restaurant: ["restaurant", "fast_food", "food_court", "pub", "biergarten"],
  cafe: ["cafe", "bakery"],
  attraction: ["attraction", "theme_park", "zoo", "observation_tower"],
  viewpoint: ["viewpoint"],
  nature: ["spring", "peak", "cave_entrance", "waterfall"],
  beach: ["beach"],
  museum: ["museum"],
  historic: ["archaeological", "ruins", "castle", "fort", "monument", "battlefield"],
  picnic: ["picnic_site"],
  supermarket: ["supermarket", "convenience", "greengrocer", "marketplace"],
  fuel: ["fuel"],
  gear: ["outdoor_shop"],
};
const LAYERS = [
  "gis_osm_pois_free_1",
  "gis_osm_pois_a_free_1",
  "gis_osm_natural_free_1",
  "gis_osm_natural_a_free_1",
  "gis_osm_traffic_free_1",
];

const CATEGORY_OF = new Map(
  Object.entries(CATEGORIES).flatMap(([category, classes]) => classes.map((fclass) => [fclass, category]))
);

// --- Minimal shapefile reader -------------------------------------------------
// .dbf: 32-byte header (record count @4, header length @8, record length @10),
// then 32-byte field descriptors until 0x0D; each record is a deletion flag
// byte followed by fixed-width, space-padded text fields (UTF-8 per the .cpg).
// .shp: 100-byte header, then records of [8-byte big-endian header][content];
// content starts with the shape type: 1 = point (x, y doubles), 5 = polygon
// (bounding box first; its center stands in for the area's position).

function readDbf(file) {
  const buf = fs.readFileSync(file);
  const count = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = [];
  for (let off = 32, pos = 1; buf[off] !== 0x0d; off += 32) {
    const name = buf.toString("latin1", off, off + 11).replace(/\0.*$/, "");
    const length = buf[off + 16];
    fields.push({ name, pos, length });
    pos += length;
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const start = headerLength + i * recordLength;
    const row = {};
    for (const field of fields) {
      row[field.name] = buf.toString("utf8", start + field.pos, start + field.pos + field.length).trim();
    }
    rows.push(row);
  }
  return rows;
}

function readShpPositions(file) {
  const buf = fs.readFileSync(file);
  const positions = [];
  let off = 100;
  while (off + 8 <= buf.length) {
    const contentBytes = buf.readInt32BE(off + 4) * 2;
    const content = off + 8;
    const type = buf.readInt32LE(content);
    if (type === 1) {
      positions.push({ lng: buf.readDoubleLE(content + 4), lat: buf.readDoubleLE(content + 12) });
    } else if (type === 5) {
      const [xmin, ymin, xmax, ymax] = [4, 12, 20, 28].map((o) => buf.readDoubleLE(content + o));
      positions.push({ lng: (xmin + xmax) / 2, lat: (ymin + ymax) / 2 });
    } else {
      positions.push(null);
    }
    off = content + contentBytes;
  }
  return positions;
}

// -----------------------------------------------------------------------------

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function loadPlaces(shpDir) {
  const places = [];
  for (const layer of LAYERS) {
    const base = path.join(shpDir, layer);
    if (!fs.existsSync(`${base}.dbf`)) {
      console.warn(`  missing layer ${layer}, skipped`);
      continue;
    }
    const rows = readDbf(`${base}.dbf`);
    const positions = readShpPositions(`${base}.shp`);
    let kept = 0;
    rows.forEach((row, i) => {
      const category = CATEGORY_OF.get(row.fclass);
      const position = positions[i];
      // Names like "#S1" are mapper codes, not names a visitor would know.
      if (!category || !position || !row.name || row.name.startsWith("#") || !/\p{L}{2}/u.test(row.name)) return;
      places.push({ name: row.name, category, type: row.fclass, ...position });
      kept++;
    });
    console.log(`  ${layer}: ${kept} named places of interest`);
  }
  return places;
}

function main() {
  const shpArg = process.argv.find((arg) => arg.startsWith("--shp="));
  if (!shpArg) {
    console.error("Usage: node scripts/buildNearbyPlaces.js --shp=<unzipped Geofabrik shapefile folder>");
    process.exit(1);
  }
  const shpDir = path.resolve(shpArg.slice("--shp=".length));

  console.log("Reading OpenStreetMap layers...");
  const places = loadPlaces(shpDir);
  const { campsites } = JSON.parse(fs.readFileSync(CAMPSITES, "utf8"));

  const byCampsite = {};
  for (const site of campsites) {
    if (!site.coordinates) continue;
    const near = new Map();
    for (const place of places) {
      const km = distanceKm(site.coordinates, place);
      if (km > RADIUS_KM) continue;
      // The same place is often mapped twice (a point plus an outline).
      const key = `${place.category}:${place.name}`;
      const existing = near.get(key);
      if (existing && existing.distanceKm <= km) continue;
      near.set(key, {
        name: place.name,
        category: place.category,
        type: place.type,
        distanceKm: Math.round(km * 10) / 10,
        lat: Math.round(place.lat * 1e5) / 1e5,
        lng: Math.round(place.lng * 1e5) / 1e5,
      });
    }
    const grouped = {};
    for (const place of near.values()) (grouped[place.category] ??= []).push(place);
    byCampsite[site.id] = Object.values(grouped).flatMap((list) =>
      list.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_PER_CATEGORY)
    );
    console.log(`  ${site.id}: ${byCampsite[site.id].length}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: "© OpenStreetMap contributors (ODbL), Geofabrik extract",
      radiusKm: RADIUS_KM,
      byCampsite,
    }) + "\n"
  );
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
}

main();
