import mask from "../../assets/data/mapMask.json";

/** A point as [latitude, longitude]. */
export type MaskPoint = [number, number];

/**
 * What the map paints over so that only Israel is left showing. Produced by
 * scripts/buildMapMask.js from OpenStreetMap border outlines — that file
 * documents the method and which areas are erased (the neighbouring
 * countries and the Gaza Strip; Israel, the Golan and the West Bank stay
 * visible). Shared by Map.web.tsx and Map.native.tsx.
 *
 * It comes in two parts:
 *   - MASK_WINDOW: the rectangle around Israel inside which the map shows
 *     through at all. Each map component covers everything outside it with
 *     one frame (a world-sized polygon with this rectangle as its hole).
 *   - MASK_RINGS: the erased areas inside that rectangle, as closed outlines.
 *
 * The double assertion is for the same reason as in data/campsites.ts:
 * TypeScript reads JSON coordinate pairs as `number[]`, not as a tuple.
 */
export const MASK_WINDOW: { south: number; west: number; north: number; east: number } = mask.window;

export const MASK_RINGS: MaskPoint[][] = (mask.areas as unknown as { id: string; rings: MaskPoint[][] }[]).flatMap(
  (area) => area.rings
);

/** MASK_WINDOW as a closed outline — the hole in the frame. */
export const MASK_WINDOW_RING: MaskPoint[] = [
  [MASK_WINDOW.south, MASK_WINDOW.west],
  [MASK_WINDOW.south, MASK_WINDOW.east],
  [MASK_WINDOW.north, MASK_WINDOW.east],
  [MASK_WINDOW.north, MASK_WINDOW.west],
];

/** The outside of the frame: far beyond anything the map can be panned to. */
export const MASK_OUTER_RING: MaskPoint[] = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
];
