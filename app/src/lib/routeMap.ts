import { getCampsiteById } from "@/data/campsites";
import type { Itinerary } from "@/types/itinerary";

/**
 * The trip map for the itinerary PDF (web only: it draws on a <canvas>): an
 * OpenStreetMap view of the area the trip covers, with each day's route as
 * a coloured line, its stops as dots and each night's campsite as a
 * numbered marker. Nadav (2026-10-22): "every time the agent creates a PDF
 * for the itinerary, also a picture of the area with lines showing the route".
 *
 * WHERE THE POINTS COME FROM
 * A day's route runs through its stops (items with coordinates, in plan
 * order) and ends at that night's campsite (looked up in the bundled
 * campsite list). Day 2 starts from day 1's campsite, so the days join up.
 * Stops without coordinates (the agent only has them for places in its
 * nearby-places data) are skipped. A plan with no coordinates at all gets
 * no map.
 *
 * EXTERNAL SERVICES (both allow cross-origin use, checked 2026-10-22)
 * - Map tiles: tile.openstreetmap.org. Its usage policy asks for
 *   attribution (drawn in the corner) and light use: one map is ~20 tiles,
 *   fetched only when someone downloads a PDF.
 * - Routes: FOSSGIS's public OSRM servers (routing.openstreetmap.de), one
 *   request per day: the walking profile for a day of hikes without any
 *   drive, the car profile otherwise. They are free services without
 *   guarantees, so on any failure or timeout that day is drawn as dashed
 *   straight lines between its points instead, and the PDF is never
 *   blocked on them. (router.project-osrm.org, the better-known demo
 *   server, has no walking profile.)
 * Tiles are loaded as CORS images (`crossOrigin = "anonymous"`); without
 * that the canvas would be "tainted" and could not be exported to the PDF.
 */

type Point = { lat: number; lng: number };
type Profile = "foot" | "car";

type DayRoute = {
  dayNumber: number;
  color: string;
  profile: Profile;
  /** In visiting order; the first may be the previous night's campsite. */
  points: Point[];
  /** Points that are this day's stops (drawn as dots). */
  stops: Point[];
  camp: Point | null;
  /** Road geometry from OSRM, or null to draw straight lines. */
  road: Point[] | null;
  /** Driving distance from OSRM, when it answered. */
  roadKm: number | null;
};

export type RouteMap = {
  canvas: HTMLCanvasElement;
  /** Per day, for the legend under the map. */
  days: { dayNumber: number; title: string; color: string; profile: Profile; roadKm: number | null }[];
};

/** Distinct on the map tiles' greens and beiges, and from each other. */
const DAY_COLORS = ["#1F6FD1", "#D2541F", "#7B3FB5", "#0F8A6B", "#C2185B", "#8A6D00"];

const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
// The path segment after the profile is always "driving" in OSRM's API;
// the server (routed-foot / routed-car) decides the mode.
const ROUTER_URL: Record<Profile, string> = {
  foot: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  car: "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
};
const MAX_ZOOM = 15;
const TIMEOUT_MS = 8000;

// Web Mercator, in world pixels at zoom z (the same projection as the tiles).
function project({ lat, lng }: Point, z: number) {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

const samePlace = (a: Point, b: Point) => Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lng - b.lng) < 0.002;

function collectRoutes(itinerary: Itinerary): DayRoute[] {
  const routes: DayRoute[] = [];
  let previousCamp: Point | null = null;
  for (const [index, day] of itinerary.plan.days.entries()) {
    const stops: Point[] = day.items
      .filter((item) => item.lat != null && item.lng != null)
      .map((item) => ({ lat: item.lat!, lng: item.lng! }));
    const campsite = day.campsiteId ? getCampsiteById(day.campsiteId) : undefined;
    const camp = campsite?.coordinates ?? null;

    const points: Point[] = [];
    const add = (point: Point) => {
      if (!points.length || !samePlace(points[points.length - 1], point)) points.push(point);
    };
    if (previousCamp) add(previousCamp);
    stops.forEach(add);
    if (camp) add(camp);

    if (stops.length || camp) {
      const kinds = new Set(day.items.map((item) => item.kind));
      routes.push({
        dayNumber: day.dayNumber,
        color: DAY_COLORS[index % DAY_COLORS.length],
        profile: kinds.has("hike") && !kinds.has("drive") ? "foot" : "car",
        points,
        stops: camp ? stops.filter((stop) => !samePlace(stop, camp)) : stops,
        camp,
        road: null,
        roadKm: null,
      });
    }
    if (camp) previousCamp = camp;
  }
  return routes;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Fills in `road` / `roadKm` from OSRM; leaves them null on any failure. */
async function fetchRoad(route: DayRoute): Promise<void> {
  if (route.points.length < 2) return;
  const coords = route.points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  try {
    const response = await withTimeout(
      fetch(`${ROUTER_URL[route.profile]}${coords}?overview=full&geometries=geojson`),
      TIMEOUT_MS
    );
    if (!response.ok) return;
    const body = (await response.json()) as {
      code?: string;
      routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const best = body.code === "Ok" ? body.routes?.[0] : undefined;
    if (!best) return;
    route.road = best.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    route.roadKm = Math.round(best.distance / 1000);
  } catch {
    // Straight lines it is.
  }
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = TILE_URL(z, x, y);
  });
}

/** Largest zoom at which every point fits inside the frame minus padding. */
function fitZoom(points: Point[], width: number, height: number, padding: number): number {
  if (points.length === 1) return 12;
  for (let z = MAX_ZOOM; z >= 5; z--) {
    const xs = points.map((p) => project(p, z).x);
    const ys = points.map((p) => project(p, z).y);
    if (Math.max(...xs) - Math.min(...xs) <= width - 2 * padding && Math.max(...ys) - Math.min(...ys) <= height - 2 * padding) {
      return z;
    }
  }
  return 5;
}

/**
 * `width` shrinks for each later day, which is drawn on top: where two days
 * share a road (out and back), the earlier day's colour still shows along
 * both edges of the later one's line.
 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  pixels: { x: number; y: number }[],
  color: string,
  dashed: boolean,
  width: number
) {
  if (pixels.length < 2) return;
  const path = () => {
    ctx.beginPath();
    pixels.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([]);
  // A white casing under the coloured line keeps it readable over roads.
  path();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = width + 5;
  ctx.stroke();
  path();
  ctx.setLineDash(dashed ? [18, 12] : []);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();
}

/** A night's campsite: a larger marker with the day number in it. */
function drawCamp(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string, font: string) {
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Digits only, so the base direction doesn't matter.
  ctx.direction = "ltr";
  ctx.fillText(label, x, y + 1);
}

/**
 * Draws the trip map at `width` x `height` canvas pixels, or resolves null
 * when the plan has no coordinates. Never rejects: missing tiles leave a
 * plain background, a failed route becomes straight lines.
 */
export async function drawRouteMap(
  itinerary: Itinerary,
  width: number,
  height: number,
  options: { labelFont: string; attributionFont: string; background: string }
): Promise<RouteMap | null> {
  const routes = collectRoutes(itinerary);
  const allPoints = routes.flatMap((route) => route.points);
  if (!allPoints.length) return null;

  await Promise.all(routes.map(fetchRoad));

  // Frame the whole trip, including where the roads bulge past the stops.
  const framed = routes.flatMap((route) => route.road ?? route.points);
  const padding = 70;
  const z = fitZoom(framed, width, height, padding);
  const xs = framed.map((p) => project(p, z).x);
  const ys = framed.map((p) => project(p, z).y);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const origin = { x: center.x - width / 2, y: center.y - height / 2 };
  const toCanvas = (p: Point) => {
    const world = project(p, z);
    return { x: world.x - origin.x, y: world.y - origin.y };
  };

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, width, height);

  // Tiles covering the frame.
  const tileCount = 2 ** z;
  const jobs: Promise<void>[] = [];
  for (let tx = Math.floor(origin.x / TILE); tx <= Math.floor((origin.x + width) / TILE); tx++) {
    for (let ty = Math.floor(origin.y / TILE); ty <= Math.floor((origin.y + height) / TILE); ty++) {
      if (ty < 0 || ty >= tileCount) continue;
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
      jobs.push(
        loadTile(z, wrappedX, ty).then((image) => {
          if (image) ctx.drawImage(image, tx * TILE - origin.x, ty * TILE - origin.y, TILE, TILE);
        })
      );
    }
  }
  await Promise.all(jobs);

  // Lines first, then markers on top of every line.
  routes.forEach((route, index) => {
    const width = Math.max(4, 12 - index * 2.5);
    drawLine(ctx, (route.road ?? route.points).map(toCanvas), route.color, route.road === null, width);
  });
  for (const route of routes) {
    for (const stop of route.stops) {
      const { x, y } = toCanvas(stop);
      drawDot(ctx, x, y, route.color);
    }
  }
  for (const route of routes) {
    if (!route.camp) continue;
    const { x, y } = toCanvas(route.camp);
    drawCamp(ctx, x, y, route.color, String(route.dayNumber), options.labelFont);
  }

  // Attribution, required by the OSM tile policy (and asked by FOSSGIS).
  const credit = "© OpenStreetMap contributors · routes: FOSSGIS / OSRM";
  ctx.font = options.attributionFont;
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const creditWidth = ctx.measureText(credit).width;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(0, height - 34, creditWidth + 20, 34);
  ctx.fillStyle = "#333333";
  ctx.fillText(credit, 10, height - 8);

  const titles = new Map(itinerary.plan.days.map((day) => [day.dayNumber, day.title]));
  return {
    canvas,
    days: routes.map((route) => ({
      dayNumber: route.dayNumber,
      title: titles.get(route.dayNumber) ?? "",
      color: route.color,
      profile: route.profile,
      roadKm: route.roadKm,
    })),
  };
}
