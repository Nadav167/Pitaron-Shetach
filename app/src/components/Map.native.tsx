import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, UrlTile, type MapPressEvent, type Region } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { isNightCamp } from "@/types/campsite";
import type { MapProps } from "@/types/map";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import { fonts, type ColorTokens } from "@/constants/theme";
import { MASK_OUTER_RING, MASK_RINGS, MASK_WINDOW_RING, type MaskPoint } from "@/data/mapMask";
import {
  FAVORITE_PIN_COLOR,
  ISRAEL_PAN_LIMIT,
  ISRAEL_VIEW,
  MIN_ZOOM,
  PIN_GLYPH,
  USER_LOCATION_COLOR,
} from "@/constants/map";
import { CLUSTER_MAX_ZOOM, clusterPoints, clusterSize, type Cluster } from "@/lib/cluster";

const INITIAL_REGION: Region = {
  latitude: (ISRAEL_VIEW.north + ISRAEL_VIEW.south) / 2,
  longitude: (ISRAEL_VIEW.east + ISRAEL_VIEW.west) / 2,
  latitudeDelta: (ISRAEL_VIEW.north - ISRAEL_VIEW.south) * 1.15,
  longitudeDelta: (ISRAEL_VIEW.east - ISRAEL_VIEW.west) * 1.15,
};

const toLatLng = ([latitude, longitude]: MaskPoint) => ({ latitude, longitude });
const MASK_FRAME = MASK_OUTER_RING.map(toLatLng);
const MASK_FRAME_HOLE = [MASK_WINDOW_RING.map(toLatLng)];
const MASK_POLYGONS = MASK_RINGS.map((ring) => ring.map(toLatLng));

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * The map's zoom level (as in web maps: 256px tiles, zoom 0 = the whole
 * world in one tile) for a region shown across the screen's width. The
 * clustering in src/lib/cluster.ts works in those units.
 */
function zoomOf(region: Region): number {
  const width = Dimensions.get("window").width;
  return Math.log2((360 * (width / 256)) / region.longitudeDelta);
}

type Pinnable = Campsite & { coordinates: { lat: number; lng: number } };
type ClusterInput = { id: string; lat: number; lng: number; campsite: Pinnable };

/**
 * Native (iOS/Android) map. Uses react-native-maps with a raw OpenStreetMap
 * tile overlay (UrlTile) instead of Google/Apple tiles, so no API key is
 * required — mirrors the OSM tiles Map.web.tsx uses via Leaflet.
 *
 * OSM tile policy requires attribution and reasonable request volume; swap the
 * tile URL for a paid provider before shipping at scale.
 *
 * Markers use a custom colored-circle + glyph view instead of the default
 * teardrop `pinColor`, matching Map.web.tsx's pins: one colour for all, a
 * moon (night camp) or tent (campground) inside, deep red for favorites,
 * larger and in the accent colour for the selected site. Nearby pins are
 * grouped into numbered clusters (src/lib/cluster.ts), recomputed as the
 * zoom changes; tapping one zooms to its pins.
 *
 * Custom marker views are snapshotted once (`tracksViewChanges={false}`):
 * leaving it on re-renders every marker view on every frame, which made
 * panning stutter with hundreds of pins on Android. A marker whose look
 * changes (selected, favorite) is given a new key so it is drawn afresh.
 *
 * Tapping a pin selects it; the screen shows its card (SelectedSiteCard),
 * which replaced the Callout: touches on controls inside a Callout don't
 * reach them reliably on Android.
 *
 * Land that isn't Israel is painted over in the page's background colour
 * (see data/mapMask.ts): one frame covering everything outside the window
 * around Israel, plus the outline of each erased area inside it.
 *
 * The map is locked to Israel (see constants/map.ts) in two layers, because
 * no single react-native-maps API covers both platforms: `setMapBoundaries`
 * is a hard limit but only exists on Google Maps (Android), so
 * `onRegionChangeComplete` also pulls the camera back whenever its center
 * ends up outside the limit — that is what restrains Apple Maps on iOS.
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
  const { isFavorite } = useFavorites();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [zoom, setZoom] = useState(() => zoomOf(INITIAL_REGION));

  // Sites with no verified coordinates can't be pinned; they remain in the list.
  const mappable = useMemo(
    () => campsites.filter((campsite): campsite is Pinnable => campsite.coordinates !== null),
    [campsites]
  );

  const clusters = useMemo(() => {
    const input: ClusterInput[] = mappable.map((campsite) => ({
      id: campsite.id,
      lat: campsite.coordinates.lat,
      lng: campsite.coordinates.lng,
      campsite,
    }));
    return clusterPoints(input, zoom);
  }, [mappable, zoom]);

  const mapRef = useRef<MapView>(null);

  // Same re-framing as FitToPins in Map.web.tsx: onto the pins while a
  // search/filter is active, else back to the whole country. Keyed on the
  // pins' ids so unrelated re-renders never move the map.
  const signature = fitToCampsites ? mappable.map((c) => c.id).join(",") : "";
  // Debounced like the web version, so typing a query doesn't start a new
  // camera animation on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      if (!fitToCampsites || mappable.length === 0) {
        map.animateToRegion(INITIAL_REGION, 300);
      } else if (mappable.length === 1) {
        const { lat, lng } = mappable[0].coordinates;
        map.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.1, longitudeDelta: 0.1 }, 300);
      } else {
        map.fitToCoordinates(
          mappable.map((c) => ({ latitude: c.coordinates.lat, longitude: c.coordinates.lng })),
          { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true }
        );
      }
    }, 300);
    return () => clearTimeout(timer);
    // `mappable` is represented by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToCampsites, signature]);

  useEffect(() => {
    if (!focus) return;
    const delta = 360 / 2 ** focus.zoom;
    mapRef.current?.animateToRegion(
      { latitude: focus.lat, longitude: focus.lng, latitudeDelta: delta, longitudeDelta: delta },
      600
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  const applyBoundaries = useCallback(() => {
    mapRef.current?.setMapBoundaries(
      { latitude: ISRAEL_PAN_LIMIT.north, longitude: ISRAEL_PAN_LIMIT.east },
      { latitude: ISRAEL_PAN_LIMIT.south, longitude: ISRAEL_PAN_LIMIT.west }
    );
  }, []);

  const onRegionChangeComplete = useCallback((region: Region) => {
    setZoom(zoomOf(region));
    const latitude = clamp(region.latitude, ISRAEL_PAN_LIMIT.south, ISRAEL_PAN_LIMIT.north);
    const longitude = clamp(region.longitude, ISRAEL_PAN_LIMIT.west, ISRAEL_PAN_LIMIT.east);
    if (latitude !== region.latitude || longitude !== region.longitude) {
      mapRef.current?.animateToRegion({ ...region, latitude, longitude }, 200);
    }
  }, []);

  const zoomInto = (cluster: Cluster<ClusterInput>) => {
    const { south, west, north, east } = cluster.bounds;
    if (north - south < 1e-4 && east - west < 1e-4) {
      const delta = 360 / 2 ** (CLUSTER_MAX_ZOOM + 1);
      mapRef.current?.animateToRegion(
        { latitude: cluster.lat, longitude: cluster.lng, latitudeDelta: delta, longitudeDelta: delta },
        400
      );
      return;
    }
    mapRef.current?.fitToCoordinates(
      cluster.items.map((item) => ({ latitude: item.lat, longitude: item.lng })),
      { edgePadding: { top: 60, right: 48, bottom: 60, left: 48 }, animated: true }
    );
  };

  // Android reports a marker tap to the map as well, tagged "marker-press".
  const handleMapPress = (event: MapPressEvent) => {
    if (event.nativeEvent.action === "marker-press") return;
    onMapPress?.();
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={INITIAL_REGION}
      minZoomLevel={MIN_ZOOM}
      // Keeps the framed area (and the platform's own controls and legal
      // label) clear of the search bar above and the tab bar below.
      mapPadding={{ top: overlayInsets.top, bottom: overlayInsets.bottom, left: 0, right: 0 }}
      onMapReady={applyBoundaries}
      onRegionChangeComplete={onRegionChangeComplete}
      onPress={handleMapPress}
    >
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
      <Polygon
        coordinates={MASK_FRAME}
        holes={MASK_FRAME_HOLE}
        fillColor={colors.background}
        strokeColor={colors.background}
        strokeWidth={1}
      />
      {MASK_POLYGONS.map((coordinates, index) => (
        <Polygon
          key={index}
          coordinates={coordinates}
          fillColor={colors.background}
          strokeColor={colors.background}
          strokeWidth={2}
        />
      ))}
      {userLocation && (
        <Marker
          coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.userDot} />
        </Marker>
      )}
      {clusters.map((cluster) => {
        if (cluster.items.length > 1) {
          const size = clusterSize(cluster.items.length);
          return (
            <Marker
              key={`${cluster.key}|${colors.navBar}`}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => zoomInto(cluster)}
            >
              <View
                style={[
                  styles.cluster,
                  // The deep green, as on web: white on night mode's lighter
                  // primary measured 3.3:1.
                  { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.navBar },
                ]}
              >
                <Text style={styles.clusterText}>{cluster.items.length}</Text>
              </View>
            </Marker>
          );
        }
        const { campsite } = cluster.items[0];
        const selected = campsite.id === selectedId;
        const favorite = isFavorite(campsite.id);
        // One green for every pin (deep red for favorites); the glyph tells
        // the kinds apart, as on web: moon = night camp, tent = campground.
        const pinColor = selected ? colors.accentDeep : favorite ? FAVORITE_PIN_COLOR : colors.primary;
        const pinGlyph = isNightCamp(campsite) ? PIN_GLYPH.official : PIN_GLYPH.unofficial;
        return (
          <Marker
            // A new key whenever the pin's look changes: with
            // tracksViewChanges off, the old snapshot would stay otherwise.
            key={`${campsite.id}|${selected ? "s" : favorite ? "f" : "n"}|${colors.primary}`}
            coordinate={{ latitude: campsite.coordinates.lat, longitude: campsite.coordinates.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={selected ? 1000 : undefined}
            onPress={() => onPinPress?.(campsite)}
          >
            <View style={[styles.pin, selected && styles.pinSelected, { backgroundColor: pinColor }]}>
              <MaterialCommunityIcons name={pinGlyph} size={selected ? 20 : 16} color="#FFFFFF" />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    map: { flex: 1, backgroundColor: colors.background },
    pin: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    pinSelected: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
    cluster: {
      borderWidth: 3,
      borderColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    clusterText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#FFFFFF" },
    userDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      borderColor: "#FFFFFF",
      backgroundColor: USER_LOCATION_COLOR,
    },
  });
}
