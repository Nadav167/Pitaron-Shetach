/**
 * Map pin clustering, shared by the web (Leaflet) and native
 * (react-native-maps) maps so both group pins the same way.
 *
 * Why: at country zoom the 400+ pins overlapped into one solid mass, so the
 * map showed nothing until zoomed in several levels. Clustering draws one
 * numbered bubble per group of nearby pins instead; tapping it zooms in.
 *
 * How: pins are projected to Web-Mercator pixel coordinates at the current
 * zoom (the same 256px-tile projection both map libraries use), and grouped
 * greedily: walking the pins in order, each pin not yet in a group starts a
 * new group and pulls in every remaining pin within `radiusPx` of it. That
 * is O(n²) per zoom level, about 160k distance checks for 405 pins: well
 * under a millisecond, and only redone when the zoom changes. (A spatial
 * index like supercluster's k-d tree pays off from tens of thousands of
 * points; written in-house to avoid a new dependency.)
 *
 * The order of `points` decides which pin seeds a group, so callers pass a
 * stable order (the dataset's) to keep groups from jumping between renders.
 */

export type Bounds = { south: number; west: number; north: number; east: number };

export type Cluster<T> = {
  /** Stable while the same pins are grouped together. */
  key: string;
  /** Mean position of the group's pins. */
  lat: number;
  lng: number;
  items: T[];
  bounds: Bounds;
};

/** Beyond this zoom every pin is shown on its own. */
export const CLUSTER_MAX_ZOOM = 13;

/** Pins closer than this many screen pixels are grouped. */
export const CLUSTER_RADIUS_PX = 46;

/** Web-Mercator world-pixel position at `zoom` (256px tiles). */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function clusterPoints<T extends { id: string; lat: number; lng: number }>(
  points: T[],
  zoom: number,
  radiusPx: number = CLUSTER_RADIUS_PX
): Cluster<T>[] {
  const single = (item: T): Cluster<T> => ({
    key: item.id,
    lat: item.lat,
    lng: item.lng,
    items: [item],
    bounds: { south: item.lat, west: item.lng, north: item.lat, east: item.lng },
  });
  if (zoom > CLUSTER_MAX_ZOOM) return points.map(single);

  const projected = points.map((point) => project(point.lat, point.lng, zoom));
  const taken = new Array<boolean>(points.length).fill(false);
  const radiusSq = radiusPx * radiusPx;
  const clusters: Cluster<T>[] = [];

  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue;
    taken[i] = true;
    const members = [i];
    for (let j = i + 1; j < points.length; j++) {
      if (taken[j]) continue;
      const dx = projected[j].x - projected[i].x;
      const dy = projected[j].y - projected[i].y;
      if (dx * dx + dy * dy <= radiusSq) {
        taken[j] = true;
        members.push(j);
      }
    }

    if (members.length === 1) {
      clusters.push(single(points[i]));
      continue;
    }
    const items = members.map((index) => points[index]);
    const bounds: Bounds = { south: 90, west: 180, north: -90, east: -180 };
    let latSum = 0;
    let lngSum = 0;
    for (const item of items) {
      latSum += item.lat;
      lngSum += item.lng;
      bounds.south = Math.min(bounds.south, item.lat);
      bounds.north = Math.max(bounds.north, item.lat);
      bounds.west = Math.min(bounds.west, item.lng);
      bounds.east = Math.max(bounds.east, item.lng);
    }
    clusters.push({
      key: `${items[0].id}+${items.length}`,
      lat: latSum / items.length,
      lng: lngSum / items.length,
      items,
      bounds,
    });
  }
  return clusters;
}

/** Diameter of a cluster bubble: grows with the count, within 36-56px. */
export function clusterSize(count: number): number {
  return Math.round(Math.min(56, 32 + Math.sqrt(count) * 3));
}
