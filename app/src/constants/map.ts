/**
 * Geographic limits shared by the web (Leaflet) and native (react-native-maps)
 * map components. The app only lists sites in Israel, so the map is locked to
 * it: being able to drag over to another continent made the map feel like an
 * unconfigured default rather than part of the product.
 */

/** What the map frames when it first opens — Israel itself, Metula to Eilat. */
export const ISRAEL_VIEW = { south: 29.45, west: 34.2, north: 33.35, east: 35.9 };

/**
 * How far the map may be panned: ISRAEL_VIEW plus a margin, so a site near
 * the border can still be brought to the middle of the screen and its popup
 * has room to open.
 */
export const ISRAEL_PAN_LIMIT = { south: 28.7, west: 33.2, north: 34.1, east: 36.9 };

/** Zoomed out any further than this, the whole country is already on screen. */
export const MIN_ZOOM = 7;

/**
 * Pin colour for sites the visitor has saved as favorites — a light red, set
 * apart from the green (official) and amber (non-official) pins. It replaces
 * the pin's usual colour, so a favorite is recognisable at a glance; whether
 * the site is official is still stated inside its popup.
 */
export const FAVORITE_PIN_COLOR = "#E8736C";
