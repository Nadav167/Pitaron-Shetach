import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Callout, Marker, Polygon, UrlTile, type Region } from "react-native-maps";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { localized, type Amenities } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import { radius, spacing, type ColorTokens } from "@/constants/theme";
import { MASK_OUTER_RING, MASK_RINGS, MASK_WINDOW_RING, type MaskPoint } from "@/data/mapMask";
import { FAVORITE_PIN_COLOR, ISRAEL_PAN_LIMIT, ISRAEL_VIEW, MIN_ZOOM, PIN_GLYPH } from "@/constants/map";

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

type Props = {
  campsites: Campsite[];
  onSelectCampsite?: (campsite: Campsite) => void;
  fitToCampsites?: boolean;
};

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
 * moon (official) or tent (other) inside, deep red for favorites.
 *
 * The callout carries the non-official warning but NOT the Waze/Google Maps
 * buttons or an add-to-favorites button (the web popup has both): touches on
 * individual controls inside a Callout don't propagate reliably on Android
 * (the whole callout is one tappable surface). Tapping it opens the detail
 * screen, where those buttons live and work.
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
export default function Map({ campsites, onSelectCampsite, fitToCampsites = false }: Props) {
  const { locale, t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isFavorite } = useFavorites();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  // Sites with no verified coordinates can't be pinned; they remain in the list.
  const mappable = campsites.filter(
    (campsite): campsite is Campsite & { coordinates: { lat: number; lng: number } } =>
      campsite.coordinates !== null
  );

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
          { edgePadding: { top: 60, right: 40, bottom: 120, left: 40 }, animated: true }
        );
      }
    }, 300);
    return () => clearTimeout(timer);
    // `mappable` is represented by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToCampsites, signature]);

  const applyBoundaries = useCallback(() => {
    mapRef.current?.setMapBoundaries(
      { latitude: ISRAEL_PAN_LIMIT.north, longitude: ISRAEL_PAN_LIMIT.east },
      { latitude: ISRAEL_PAN_LIMIT.south, longitude: ISRAEL_PAN_LIMIT.west }
    );
  }, []);

  const keepInsideIsrael = useCallback((region: Region) => {
    const latitude = clamp(region.latitude, ISRAEL_PAN_LIMIT.south, ISRAEL_PAN_LIMIT.north);
    const longitude = clamp(region.longitude, ISRAEL_PAN_LIMIT.west, ISRAEL_PAN_LIMIT.east);
    if (latitude !== region.latitude || longitude !== region.longitude) {
      mapRef.current?.animateToRegion({ ...region, latitude, longitude }, 200);
    }
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={INITIAL_REGION}
      minZoomLevel={MIN_ZOOM}
      onMapReady={applyBoundaries}
      onRegionChangeComplete={keepInsideIsrael}
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
      {mappable.map((campsite) => {
        const name = localized(campsite.name, locale);
        const price = campsite.pricing.isFree
          ? t("common.free")
          : campsite.pricing.perNight != null
          ? `₪${campsite.pricing.perNight}`
          : t("common.priceUnknown");
        // One green for every pin (deep red for favorites); the glyph tells
        // the kinds apart, as on web: moon = official, tent = other.
        const pinColor = isFavorite(campsite.id) ? FAVORITE_PIN_COLOR : colors.primary;
        const pinGlyph = campsite.isOfficial ? PIN_GLYPH.official : PIN_GLYPH.unofficial;
        const { note: hours, checkIn, checkOut } = campsite.openingHours;
        const amenities = (Object.entries(campsite.amenities) as [keyof Amenities, boolean | undefined][])
          .filter(([, enabled]) => enabled === true)
          .map(([key]) => t(`site.amenity.${key}`));
        const phone = campsite.contact.phone;

        return (
          <Marker
            key={campsite.id}
            coordinate={{
              latitude: campsite.coordinates.lat,
              longitude: campsite.coordinates.lng,
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.pin, { backgroundColor: pinColor }]}>
              <MaterialCommunityIcons name={pinGlyph} size={16} color="#FFFFFF" />
            </View>
            <Callout tooltip={false} onPress={() => onSelectCampsite?.(campsite)}>
              <View style={styles.callout}>
                <Text variant="titleSmall" numberOfLines={2} style={styles.text}>
                  {name}
                </Text>
                <Text variant="bodySmall" style={[styles.text, styles.muted]}>
                  {`${t(`region.${campsite.region}`)} · ${price}`}
                </Text>
                {hours ? (
                  <Text variant="bodySmall" numberOfLines={3} style={styles.text}>
                    {`${t("site.openingHours")}: ${hours}`}
                  </Text>
                ) : null}
                {checkIn || checkOut ? (
                  <Text variant="bodySmall" style={styles.text}>
                    {[checkIn && `${t("site.checkIn")} ${checkIn}`, checkOut && `${t("site.checkOut")} ${checkOut}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
                {amenities.length > 0 ? (
                  <Text variant="bodySmall" style={styles.text}>{`${t("site.amenities")}: ${amenities.join(", ")}`}</Text>
                ) : null}
                {phone ? <Text variant="bodySmall" style={styles.text}>{`${t("site.phone")}: ${phone}`}</Text> : null}

                {!campsite.isOfficial && (
                  <View style={styles.warning}>
                    <Text variant="labelSmall" style={[styles.text, styles.warningText]}>
                      {`⚠️ ${t("site.unofficialWarning")}`}
                    </Text>
                  </View>
                )}

                <Text variant="labelSmall" style={[styles.text, styles.cta]}>
                  {t("site.viewDetails")}
                </Text>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  return StyleSheet.create({
    map: { flex: 1 },
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
    callout: { width: 230, padding: spacing.sm, gap: spacing.xs },
    // Paper's <Text> hardcodes textAlign: "left"; the layout is always RTL.
    text: { textAlign: "right", writingDirection },
    muted: { color: colors.textMuted },
    warning: {
      backgroundColor: colors.accentTint,
      borderColor: colors.accent,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
    },
    warningText: { color: colors.accentDeep },
    cta: { color: colors.primary, marginTop: spacing.xs },
  });
}
