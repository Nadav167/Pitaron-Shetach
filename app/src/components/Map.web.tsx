import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";
import { navigationUrlsFor } from "@/lib/navigation";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import type { ColorTokens } from "@/constants/theme";

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
 * amber pin is a third-party listing that may be out of date. Each pin
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

  const officialIcon = useMemo(() => pinIcon(colors.primary), [colors.primary]);
  const unofficialIcon = useMemo(() => pinIcon(colors.accent), [colors.accent]);
  const linkStyle = useMemo(() => linkStyleFor(colors), [colors]);

  // Sites with no verified coordinates can't be pinned — they stay in the list
  // view instead. Never invent a position to make the map look fuller.
  const mappable = campsites.filter(
    (campsite): campsite is Campsite & { coordinates: { lat: number; lng: number } } =>
      campsite.coordinates !== null
  );

  const center: [number, number] = mappable[0]
    ? [mappable[0].coordinates.lat, mappable[0].coordinates.lng]
    : [31.5, 34.8];

  return (
    <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mappable.map((campsite) => {
        const nav = navigationUrlsFor(campsite);
        const name = localized(campsite.name, locale);
        const price = campsite.pricing.isFree
          ? t("common.free")
          : campsite.pricing.perNight != null
          ? `₪${campsite.pricing.perNight}`
          : t("common.priceUnknown");

        return (
          <Marker
            key={campsite.id}
            position={[campsite.coordinates.lat, campsite.coordinates.lng]}
            icon={campsite.isOfficial ? officialIcon : unofficialIcon}
          >
            <Popup>
              <div dir={locale === "he" ? "rtl" : "ltr"} style={{ minWidth: 180 }}>
                <strong style={{ fontSize: 14, color: colors.text }}>{name}</strong>
                <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {t(`region.${campsite.region}`)} · {price}
                </div>

                {!campsite.isOfficial && (
                  <div
                    role="alert"
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
                  onClick={() => onSelectCampsite?.(campsite)}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "6px 8px",
                    border: "none",
                    borderRadius: 6,
                    background: colors.primary,
                    color: colors.onPrimary,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
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
