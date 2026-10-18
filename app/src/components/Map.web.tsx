import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Campsite } from "@/types/campsite";
import { localized, type Amenities } from "@/types/campsite";
import { navigationUrlsFor } from "@/lib/navigation";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import type { ColorTokens } from "@/constants/theme";
import { MASK_OUTER_RING, MASK_RINGS, MASK_WINDOW_RING } from "@/data/mapMask";
import { FAVORITE_PIN_COLOR, ISRAEL_PAN_LIMIT, ISRAEL_VIEW, MIN_ZOOM } from "@/constants/map";

/**
 * Leaflet's CSS ships its default marker icons as relative `url(images/...)`
 * references and auto-detects that folder by reading a background-image off a
 * hidden element. Metro doesn't process url() inside CSS the way webpack does,
 * so those PNGs 404 and markers render iconless. Pointing Leaflet at the same
 * images on a CDN sidesteps bundler asset resolution entirely.
 *
 * Kept as a safety net: the markers below are `divIcon`s built from inline SVG,
 * which need no image files at all, but any default marker added later still
 * gets a working icon instead of a broken one.
 * Background: https://github.com/Leaflet/Leaflet/issues/4968
 */
const LEAFLET_CDN = "https://unpkg.com/leaflet@1.9.4/dist/images";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${LEAFLET_CDN}/marker-icon-2x.png`,
  iconUrl: `${LEAFLET_CDN}/marker-icon.png`,
  shadowUrl: `${LEAFLET_CDN}/marker-shadow.png`,
});

/**
 * Official and non-official sites get visually distinct pins, because that
 * distinction is the whole point of the unified dataset: a green pin is a
 * Parks Authority campground with published prices and a booking system, an
 * amber pin is a third-party listing that may be out of date. A site saved
 * as a favorite gets a light-red pin instead, whichever kind it is. Each pin
 * carries a small tent glyph (matching the mockup's map pins, which weren't
 * plain teardrops either) rather than an empty circle.
 *
 * Built as inline-SVG divIcons so they carry no external image dependency.
 * Colors come from the current theme, so pins re-render correctly in dark
 * mode instead of using the light-mode palette unconditionally.
 */
function pinIcon(fill: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 40 48">
      <path d="M20 47S3 27.8 3 17a17 17 0 1 1 34 0c0 10.8-17 30-17 30Z" fill="${fill}"/>
      <circle cx="20" cy="17" r="11" fill="#FFFFFF"/>
      <path d="M20 10 27 22H13Z" fill="${fill}"/>
      <path d="M20 15 24 22H16Z" fill="#FFFFFF"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "campingil-pin",
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -34],
  });
}

const INITIAL_BOUNDS: L.LatLngBoundsExpression = [
  [ISRAEL_VIEW.south, ISRAEL_VIEW.west],
  [ISRAEL_VIEW.north, ISRAEL_VIEW.east],
];
const MAX_BOUNDS: L.LatLngBoundsExpression = [
  [ISRAEL_PAN_LIMIT.south, ISRAEL_PAN_LIMIT.west],
  [ISRAEL_PAN_LIMIT.north, ISRAEL_PAN_LIMIT.east],
];

// Everything outside the window around Israel: one polygon with a hole.
const MASK_FRAME = [MASK_OUTER_RING, MASK_WINDOW_RING];

type Props = {
  campsites: Campsite[];
  onSelectCampsite?: (campsite: Campsite) => void;
};

/**
 * Web map, rendered only on react-native-web (Metro resolves `Map.web.tsx` for
 * web and `Map.native.tsx` for iOS/Android). Uses Leaflet + OpenStreetMap.
 *
 * Popup content is written as plain DOM rather than react-native-web
 * components: this file is web-only, and Leaflet renders popups into its own
 * detached DOM node, where RN-web's layout primitives are more trouble than
 * they're worth.
 */
export default function Map({ campsites, onSelectCampsite }: Props) {
  const { locale, t } = useLocale();
  const colors = useThemeColors();
  const { isFavorite, toggleFavorite } = useFavorites();

  const favoriteIcon = useMemo(() => pinIcon(FAVORITE_PIN_COLOR), []);
  const officialIcon = useMemo(() => pinIcon(colors.primary), [colors.primary]);
  const unofficialIcon = useMemo(() => pinIcon(colors.accent), [colors.accent]);
  const linkStyle = useMemo(() => linkStyleFor(colors), [colors]);
  // Land that isn't Israel is painted over in the page's own background
  // colour, so the country reads as a cut-out (see data/mapMask.ts). The
  // thin stroke in the same colour closes hairline seams between pieces.
  const maskStyle = useMemo(
    () => ({
      color: colors.background,
      weight: 2,
      fillColor: colors.background,
      fillOpacity: 1,
      interactive: false,
    }),
    [colors.background]
  );

  // Sites with no verified coordinates can't be pinned — they stay in the list
  // view instead. Never invent a position to make the map look fuller.
  const mappable = campsites.filter(
    (campsite): campsite is Campsite & { coordinates: { lat: number; lng: number } } =>
      campsite.coordinates !== null
  );

  // Opens framed on the whole country and stays there: `maxBounds` with a
  // viscosity of 1 makes the edge a hard stop (the default lets the map be
  // dragged past it and then springs back), and `minZoom` stops zooming out
  // to a view where the limit would no longer mean anything.
  return (
    <MapContainer
      bounds={INITIAL_BOUNDS}
      maxBounds={MAX_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={MIN_ZOOM}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polygon positions={MASK_FRAME} pathOptions={maskStyle} />
      {MASK_RINGS.map((ring, index) => (
        <Polygon key={index} positions={ring} pathOptions={maskStyle} />
      ))}
      {mappable.map((campsite) => {
        const nav = navigationUrlsFor(campsite);
        const name = localized(campsite.name, locale);
        const price = campsite.pricing.isFree
          ? t("common.free")
          : campsite.pricing.perNight != null
          ? `₪${campsite.pricing.perNight}`
          : t("common.priceUnknown");
        const favorite = isFavorite(campsite.id);
        const cover = campsite.photos.find((photo) => !photo.isPlaceholder);
        const { note: hours, checkIn, checkOut } = campsite.openingHours;
        // Only amenities the source positively confirmed (see the detail screen).
        const amenities = (Object.entries(campsite.amenities) as [keyof Amenities, boolean | undefined][])
          .filter(([, enabled]) => enabled === true)
          .map(([key]) => t(`site.amenity.${key}`));
        const phone = campsite.contact.phone;

        return (
          <Marker
            key={campsite.id}
            position={[campsite.coordinates.lat, campsite.coordinates.lng]}
            icon={favorite ? favoriteIcon : campsite.isOfficial ? officialIcon : unofficialIcon}
          >
            <Popup>
              {/* The popup keeps the right-to-left layout in every language,
                  like the rest of the app; `dir="auto"` on the text lines
                  lets an English name or price still read left-to-right. */}
              <div dir="rtl" style={{ width: 230, textAlign: "right" }}>
                {cover && (
                  <img
                    src={cover.url}
                    alt=""
                    style={{ display: "block", width: "100%", height: 96, objectFit: "cover", borderRadius: 6, marginBottom: 8 }}
                  />
                )}
                <strong dir="auto" style={{ display: "block", fontSize: 14, color: colors.text }}>
                  {name}
                </strong>
                <div dir="auto" style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {t(`region.${campsite.region}`)} · {price}
                </div>

                {hours && (
                  <div dir="auto" style={factStyle}>
                    <b>{t("site.openingHours")}:</b> {hours}
                  </div>
                )}
                {(checkIn || checkOut) && (
                  <div dir="auto" style={factStyle}>
                    {[checkIn && `${t("site.checkIn")} ${checkIn}`, checkOut && `${t("site.checkOut")} ${checkOut}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {amenities.length > 0 && (
                  <div dir="auto" style={factStyle}>
                    <b>{t("site.amenities")}:</b> {amenities.join(", ")}
                  </div>
                )}
                {phone && (
                  <div dir="auto" style={factStyle}>
                    <b>{t("site.phone")}:</b>{" "}
                    <a href={`tel:${phone}`} dir="ltr" style={{ color: colors.primary }}>
                      {phone}
                    </a>
                  </div>
                )}

                {!campsite.isOfficial && (
                  <div
                    role="alert"
                    dir="auto"
                    style={{
                      marginTop: 6,
                      padding: "4px 6px",
                      background: colors.accentTint,
                      border: `1px solid ${colors.accent}`,
                      borderRadius: 4,
                      color: colors.accentDeep,
                      fontSize: 11,
                    }}
                  >
                    ⚠️ {t("site.unofficialWarning")}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <a href={nav.waze} target="_blank" rel="noreferrer" style={linkStyle}>
                    {t("site.navigateWaze")}
                  </a>
                  <a href={nav.googleMaps} target="_blank" rel="noreferrer" style={linkStyle}>
                    {t("site.navigateGoogleMaps")}
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(campsite.id)}
                  aria-pressed={favorite}
                  style={{
                    ...buttonStyle,
                    border: `1px solid ${FAVORITE_PIN_COLOR}`,
                    background: favorite ? FAVORITE_PIN_COLOR : "transparent",
                    color: favorite ? "#FFFFFF" : colors.danger,
                  }}
                >
                  {favorite ? "♥" : "♡"} {t(favorite ? "site.removeFromFavorites" : "site.addToFavorites")}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectCampsite?.(campsite)}
                  style={{ ...buttonStyle, border: "none", background: colors.primary, color: colors.onPrimary }}
                >
                  {t("site.viewDetails")}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

/** One line of extra detail in the popup (hours, amenities, phone). */
const factStyle: React.CSSProperties = { fontSize: 12, marginTop: 4, lineHeight: 1.35 };

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};

function linkStyleFor(colors: ColorTokens): React.CSSProperties {
  return {
    flex: 1,
    textAlign: "center",
    padding: "5px 6px",
    borderRadius: 6,
    background: colors.surfaceAlt,
    color: colors.text,
    fontSize: 12,
    textDecoration: "none",
  };
}
