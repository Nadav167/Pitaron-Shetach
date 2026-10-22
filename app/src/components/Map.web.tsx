import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Marker, Polygon, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Campsite } from "@/types/campsite";
import { isNightCamp } from "@/types/campsite";
import type { MapProps } from "@/types/map";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useResponsive } from "@/hooks/useResponsive";
import { MASK_OUTER_RING, MASK_RINGS, MASK_WINDOW_RING } from "@/data/mapMask";
import { FAVORITE_PIN_COLOR, ISRAEL_PAN_LIMIT, ISRAEL_VIEW, MIN_ZOOM, USER_LOCATION_COLOR } from "@/constants/map";
import { CLUSTER_MAX_ZOOM, clusterPoints, clusterSize, type Cluster } from "@/lib/cluster";

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
 * Every pin is the same green; the glyph inside tells official and
 * non-official sites apart (see PIN_GLYPH): a crescent moon for a Parks
 * Authority night campground (published prices, a booking system), a tent
 * for a third-party campsite listing that may be out of date. A site saved
 * as a favorite gets a deep-red pin instead, keeping its glyph, and the site
 * whose card is open gets a larger pin in the accent colour.
 *
 * Built as inline-SVG divIcons so they carry no external image dependency.
 * Colors come from the current theme, so pins re-render correctly in dark
 * mode instead of using the light-mode palette unconditionally.
 */
function pinIcon(fill: string, official: boolean, scale = 1) {
  const glyph = official
    ? // Crescent: a disc with a white disc over its upper-right part.
      `<circle cx="19" cy="17.5" r="7" fill="${fill}"/>
       <circle cx="22.5" cy="14.5" r="6" fill="#FFFFFF"/>`
    : // Tent: a triangle with a door cut out.
      `<path d="M20 10 27 22H13Z" fill="${fill}"/>
       <path d="M20 15 24 22H16Z" fill="#FFFFFF"/>`;
  const width = Math.round(32 * scale);
  const height = Math.round(38 * scale);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 40 48">
      <path d="M20 47S3 27.8 3 17a17 17 0 1 1 34 0c0 10.8-17 30-17 30Z" fill="${fill}" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="20" cy="17" r="11" fill="#FFFFFF"/>
      ${glyph}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "campingil-pin",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
}

/** A numbered bubble standing for several nearby pins. */
function clusterIcon(count: number, fill: string) {
  const size = clusterSize(count);
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:3px solid #FFFFFF;box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font:700 ${size > 44 ? 15 : 14}px Heebo, system-ui, sans-serif">${count}</div>`;
  return L.divIcon({ html, className: "campingil-cluster", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
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

type Insets = { top: number; bottom: number };

/** Leaflet padding that keeps a fitted area clear of the floating overlays. */
function fitPadding(insets: Insets, side = 16): L.FitBoundsOptions {
  return { paddingTopLeft: [side, insets.top + 8], paddingBottomRight: [side, insets.bottom + 8] };
}

/**
 * Re-frames the map whenever the set of pins changes: onto the pins when
 * `active` (a search or filter is narrowing them down), else back onto the
 * whole country. Keyed on the pins' ids, not the array, so an unrelated
 * re-render (theme, favorites, selecting a pin) never moves the map under
 * the user's hand. A single pin is shown at a fixed zoom rather than "fit"
 * to, which would zoom all the way in.
 */
function FitToPins({ points, active, insets }: { points: [number, number][]; active: boolean; insets: Insets }) {
  const map = useMap();
  const signature = active ? points.map((p) => p.join(",")).join(";") : "";
  useEffect(() => {
    // Debounced: typing a query changes the pins on every keystroke, and a
    // new fit started while the previous zoom animation is still running is
    // dropped by Leaflet, which left the map stuck on the country view.
    const timer = setTimeout(() => {
      map.stop();
      // The container may have been measured before the screen's layout
      // settled (the overlays are laid out first); re-measure before fitting.
      map.invalidateSize();
      if (!active || points.length === 0) {
        map.fitBounds(INITIAL_BOUNDS, fitPadding(insets, 8));
      } else if (points.length === 1) {
        map.setView(points[0], 12);
      } else {
        map.fitBounds(points, { ...fitPadding(insets, 40), maxZoom: 12 });
      }
    }, 300);
    return () => clearTimeout(timer);
    // `points` is represented by `signature`; insets only matter at the next fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, active, signature, insets.top, insets.bottom]);
  return null;
}

/** Flies to `focus` each time its key changes (the locate button). */
function FocusOn({ focus }: { focus: MapProps["focus"] }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.key]);
  return null;
}

/** Lifts Leaflet's attribution line above whatever floats at the bottom. */
function AttributionClearance({ bottom }: { bottom: number }) {
  const map = useMap();
  useEffect(() => {
    const container = map.attributionControl?.getContainer();
    if (container) container.style.marginBottom = `${bottom}px`;
  }, [map, bottom]);
  return null;
}

type Pinnable = Campsite & { coordinates: { lat: number; lng: number } };
type ClusterInput = { id: string; lat: number; lng: number; campsite: Pinnable };

/**
 * The pins themselves, grouped into numbered clusters (src/lib/cluster.ts)
 * that are recomputed whenever the zoom changes. Tapping a cluster zooms
 * to its pins; tapping a pin selects it (the screen shows its card).
 */
function PinLayer({
  campsites,
  selectedId,
  onPinPress,
  onMapPress,
  insets,
}: {
  campsites: Pinnable[];
  selectedId: string | null;
  onPinPress?: (campsite: Campsite) => void;
  onMapPress?: () => void;
  insets: Insets;
}) {
  const map = useMap();
  const colors = useThemeColors();
  const { isFavorite } = useFavorites();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    // Pins and clusters don't pass their clicks on to the map, so this is
    // a tap on the map itself.
    click: () => onMapPress?.(),
  });

  const pins = useMemo(
    () => ({
      official: pinIcon(colors.primary, true),
      unofficial: pinIcon(colors.primary, false),
      favoriteOfficial: pinIcon(FAVORITE_PIN_COLOR, true),
      favoriteUnofficial: pinIcon(FAVORITE_PIN_COLOR, false),
      selectedOfficial: pinIcon(colors.accentDeep, true, 1.3),
      selectedUnofficial: pinIcon(colors.accentDeep, false, 1.3),
    }),
    [colors.primary, colors.accentDeep]
  );

  // react-leaflet calls setIcon whenever the icon object changes, which
  // rebuilds the marker's DOM, so cluster icons are cached by count.
  // (globalThis: this file's component is itself called Map.)
  const clusterIcons = useRef(new globalThis.Map<string, L.DivIcon>());
  // Clusters use a deep green (clusterFill), not `primary`: night mode
  // lightens primary, and white numbers on it measured 3.3:1.
  const iconForCluster = (count: number) => {
    const cacheKey = `${count}|${colors.clusterFill}`;
    let icon = clusterIcons.current.get(cacheKey);
    if (!icon) {
      icon = clusterIcon(count, colors.clusterFill);
      clusterIcons.current.set(cacheKey, icon);
    }
    return icon;
  };

  const clusters = useMemo(() => {
    const input: ClusterInput[] = campsites.map((campsite) => ({
      id: campsite.id,
      lat: campsite.coordinates.lat,
      lng: campsite.coordinates.lng,
      campsite,
    }));
    return clusterPoints(input, zoom);
  }, [campsites, zoom]);

  const zoomInto = (cluster: Cluster<ClusterInput>) => {
    const { south, west, north, east } = cluster.bounds;
    const nextZoom = Math.min(CLUSTER_MAX_ZOOM + 1, map.getZoom() + 4);
    // Pins at (almost) the same spot can't be told apart by fitting their
    // bounds, which would zoom all the way in: step in instead.
    if (north - south < 1e-4 && east - west < 1e-4) {
      map.flyTo([cluster.lat, cluster.lng], CLUSTER_MAX_ZOOM + 1);
    } else {
      map.flyToBounds(
        [
          [south, west],
          [north, east],
        ],
        { ...fitPadding(insets, 48), maxZoom: nextZoom }
      );
    }
  };

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.items.length > 1) {
          return (
            <Marker
              key={cluster.key}
              position={[cluster.lat, cluster.lng]}
              icon={iconForCluster(cluster.items.length)}
              eventHandlers={{ click: () => zoomInto(cluster) }}
              title={String(cluster.items.length)}
              keyboard
            />
          );
        }
        const { campsite } = cluster.items[0];
        const nightCamp = isNightCamp(campsite);
        const selected = campsite.id === selectedId;
        const icon = selected
          ? nightCamp
            ? pins.selectedOfficial
            : pins.selectedUnofficial
          : isFavorite(campsite.id)
          ? nightCamp
            ? pins.favoriteOfficial
            : pins.favoriteUnofficial
          : nightCamp
          ? pins.official
          : pins.unofficial;
        return (
          <Marker
            key={campsite.id}
            position={[campsite.coordinates.lat, campsite.coordinates.lng]}
            icon={icon}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onPinPress?.(campsite) }}
            title={campsite.name.he}
            keyboard
          />
        );
      })}
    </>
  );
}

/**
 * Web map, rendered only on react-native-web (Metro resolves `Map.web.tsx` for
 * web and `Map.native.tsx` for iOS/Android). Uses Leaflet + OpenStreetMap.
 *
 * A tapped pin no longer opens a Leaflet popup: the screen shows the site in
 * a card at the bottom (SelectedSiteCard), the same on web and native,
 * with room for a photo, Waze and the heart at full touch size.
 */
export default function Map({
  campsites,
  selectedId = null,
  onPinPress,
  onMapPress,
  fitToCampsites = false,
  userLocation = null,
  focus = null,
  overlayInsets = { top: 0, bottom: 0 },
}: MapProps) {
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();

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
  const mappable = useMemo(
    () => campsites.filter((campsite): campsite is Pinnable => campsite.coordinates !== null),
    [campsites]
  );
  const points = mappable.map((c): [number, number] => [c.coordinates.lat, c.coordinates.lng]);

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
      // Fractional zoom lets "fit to Israel / to the results" actually fill
      // the frame instead of snapping down to the next whole zoom level.
      // The +/- buttons still step by one whole level (zoomDelta).
      zoomSnap={0.25}
      // Phones zoom with two fingers, and the buttons' corner is under the
      // floating search bar there.
      zoomControl={isDesktop}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPins points={points} active={fitToCampsites} insets={overlayInsets} />
      <FocusOn focus={focus} />
      <AttributionClearance bottom={overlayInsets.bottom} />
      <Polygon positions={MASK_FRAME} pathOptions={maskStyle} />
      {MASK_RINGS.map((ring, index) => (
        <Polygon key={index} positions={ring} pathOptions={maskStyle} />
      ))}
      {userLocation && (
        <>
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={18}
            pathOptions={{ stroke: false, fillColor: USER_LOCATION_COLOR, fillOpacity: 0.18, interactive: false }}
          />
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={7}
            pathOptions={{ color: "#FFFFFF", weight: 3, fillColor: USER_LOCATION_COLOR, fillOpacity: 1, interactive: false }}
          />
        </>
      )}
      <PinLayer
        campsites={mappable}
        selectedId={selectedId}
        onPinPress={onPinPress}
        onMapPress={onMapPress}
        insets={overlayInsets}
      />
    </MapContainer>
  );
}
