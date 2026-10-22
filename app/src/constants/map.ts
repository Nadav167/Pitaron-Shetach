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
 * Pin colour for sites the visitor has saved as favorites — a deep red, set
 * apart from the green every other pin uses. It replaces the pin's usual
 * colour, so a favorite is recognisable at a glance; the glyph inside still
 * says which kind of site it is.
 */
export const FAVORITE_PIN_COLOR = "#A61E1E";

/** The "you are here" dot: the blue every map app uses for it. */
export const USER_LOCATION_COLOR = "#2F7BEA";

/**
 * All pins share one colour; the glyph inside tells the two kinds apart:
 * a moon for night camps (חניוני לילה: the Parks Authority's, KKL's and
 * the desert ones; see `isNightCamp`), a tent for campgrounds. MaterialCommunityIcons names,
 * used as-is on native; the web pins draw matching SVG shapes.
 */
export const PIN_GLYPH = { official: "weather-night", unofficial: "tent" } as const;
