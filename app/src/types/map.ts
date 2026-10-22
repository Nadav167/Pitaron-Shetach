import type { Campsite, Coordinates } from "@/types/campsite";

/** A request to move the camera, e.g. onto the visitor's location. A new
 *  `key` makes the same position fly again (the button tapped twice). */
export type MapFocus = Coordinates & { zoom: number; key: number };

/**
 * The contract both map implementations (Map.web.tsx, Map.native.tsx)
 * satisfy; Map.d.ts declares the bare `@/components/Map` import with it.
 */
export type MapProps = {
  campsites: Campsite[];
  /** The site whose card is open; its pin is drawn highlighted. */
  selectedId?: string | null;
  /** A single site's pin was tapped (cluster taps zoom in instead). */
  onPinPress?: (campsite: Campsite) => void;
  /** The map itself (not a pin) was tapped: closes the open card. */
  onMapPress?: () => void;
  /** Zoom to the pinned campsites whenever they change (e.g. a search);
   *  false/omitted keeps the whole-country view. */
  fitToCampsites?: boolean;
  /** Drawn as a blue dot when known. */
  userLocation?: Coordinates | null;
  focus?: MapFocus | null;
  /**
   * Screen space covered by things floating over the map (the search bar
   * on top, the tab bar and site card below). Framing the country or the
   * results keeps clear of it, so no pin starts out hidden underneath.
   */
  overlayInsets?: { top: number; bottom: number };
};
