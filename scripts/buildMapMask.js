#!/usr/bin/env node
/**
 * Builds app/assets/data/mapMask.json — the shapes the map paints over so
 * that only Israel is left showing (see app/src/components/Map.web.tsx).
 *
 *   node scripts/buildMapMask.js
 *
 * What gets erased was decided by Nadav (2026-10-13): the neighbouring
 * countries and the Gaza Strip. Israel, the Golan and the West Bank stay
 * visible. To change that, edit AREAS below and re-run.
 *
 * How it works
 * ------------
 * The map only ever shows a WINDOW around Israel; everything outside the
 * window is covered by one frame, drawn by the map component itself. This
 * script supplies the pieces INSIDE the window: the outline of each erased
 * area, downloaded from OpenStreetMap (Nominatim) so the cut follows exactly
 * the border drawn on the OSM tiles underneath, then:
 *   1. clipped to the window (Sutherland–Hodgman), so only the stretch of
 *      each country near Israel is stored, not all of Egypt;
 *   2. snapped to a ~100 m grid. Snapping, unlike line simplification, moves
 *      a given point to the same place whichever country it was downloaded
 *      with, so two neighbours' shared border stays shared and no sliver of
 *      map shows through between them.
 *
 * OSM country outlines include territorial waters, so the sea off Lebanon,
 * Gaza and Sinai is erased with them. That is intended.
 *
 * Data © OpenStreetMap contributors, ODbL — the same source and attribution
 * as the map tiles. Nominatim allows one request per second; this makes six.
 */

const fs = require("fs");
const path = require("path");

/**
 * The rectangle around Israel inside which the map shows through. Written
 * into the output file; the app reads it from there (app/src/data/mapMask.ts).
 */
const WINDOW = { south: 29.4, west: 33.9, north: 33.6, east: 36.2 };

const AREAS = [
  { id: "lebanon", params: { country: "Lebanon" } },
  { id: "syria", params: { country: "Syria" } },
  { id: "jordan", params: { country: "Jordan" } },
  { id: "egypt", params: { country: "Egypt" } },
  { id: "saudi-arabia", params: { country: "Saudi Arabia" } },
  { id: "gaza", params: { q: "Gaza Strip" } },
];

/** Grid the points are snapped to, in decimal places of a degree (3 ≈ 100 m). */
const DECIMALS = 3;
const OUT_FILE = path.join(__dirname, "..", "app", "assets", "data", "mapMask.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOutline(area) {
  const query = new URLSearchParams({
    ...area.params,
    format: "jsonv2",
    polygon_geojson: "1",
    polygon_threshold: "0.0003",
    limit: "5",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: { "User-Agent": "PitronShetach-map-mask-build/1.0" },
  });
  if (!response.ok) throw new Error(`${area.id}: HTTP ${response.status}`);
  const results = await response.json();
  const hit = results.find((r) => r.geojson && /Polygon$/.test(r.geojson.type));
  if (!hit) throw new Error(`${area.id}: no polygon in the response`);
  console.log(`${area.id}: ${hit.display_name} (osm ${hit.osm_type} ${hit.osm_id})`);
  // Outer rings only, as [lng, lat]. Holes (enclaves) don't occur near here.
  return hit.geojson.type === "Polygon"
    ? [hit.geojson.coordinates[0]]
    : hit.geojson.coordinates.map((polygon) => polygon[0]);
}

/** Sutherland–Hodgman: clips a ring of [lng, lat] points to WINDOW. */
function clipToWindow(ring) {
  const edges = [
    { inside: (p) => p[0] >= WINDOW.west, cut: (a, b) => atLng(a, b, WINDOW.west) },
    { inside: (p) => p[0] <= WINDOW.east, cut: (a, b) => atLng(a, b, WINDOW.east) },
    { inside: (p) => p[1] >= WINDOW.south, cut: (a, b) => atLat(a, b, WINDOW.south) },
    { inside: (p) => p[1] <= WINDOW.north, cut: (a, b) => atLat(a, b, WINDOW.north) },
  ];
  let points = ring;
  for (const edge of edges) {
    const input = points;
    points = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (edge.inside(current)) {
        if (!edge.inside(previous)) points.push(edge.cut(previous, current));
        points.push(current);
      } else if (edge.inside(previous)) {
        points.push(edge.cut(previous, current));
      }
    }
    if (points.length === 0) break;
  }
  return points;
}

const atLng = (a, b, lng) => [lng, a[1] + ((b[1] - a[1]) * (lng - a[0])) / (b[0] - a[0])];
const atLat = (a, b, lat) => [a[0] + ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]), lat];

/** Snaps to the grid, drops repeated points, returns [lat, lng] pairs. */
function snap(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    const point = [Number(lat.toFixed(DECIMALS)), Number(lng.toFixed(DECIMALS))];
    const last = out[out.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

async function main() {
  const areas = [];
  for (const area of AREAS) {
    const rings = (await fetchOutline(area)).map(clipToWindow).map(snap).filter((ring) => ring.length >= 3);
    console.log(`  -> ${rings.length} ring(s), ${rings.reduce((n, r) => n + r.length, 0)} points`);
    if (rings.length > 0) areas.push({ id: area.id, rings });
    await sleep(1100);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "OpenStreetMap contributors (ODbL), via Nominatim",
    window: WINDOW,
    areas,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output) + "\n");
  console.log(`Wrote ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
