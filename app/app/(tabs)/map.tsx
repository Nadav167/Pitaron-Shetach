import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Snackbar, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCampsites } from "@/hooks/useSites";
import { useDistanceNote, useSiteFilters } from "@/hooks/useSiteFilters";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useBottomClearance } from "@/hooks/useBottomClearance";
import Map from "@/components/Map";
import SiteList from "@/components/SiteList";
import SiteFilterBar from "@/components/SiteFilterBar";
import SelectedSiteCard from "@/components/SelectedSiteCard";
import { canLocate, locate, type LocateError } from "@/lib/locate";
import { ISRAEL_PAN_LIMIT } from "@/constants/map";
import { radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";
import type { Campsite, Coordinates } from "@/types/campsite";
import type { MapFocus } from "@/types/map";

/** Width of the desktop results panel beside the map. */
const PANEL_WIDTH = 400;

/** Above Leaflet's own panes and controls (z-index up to 1000). */
const OVERLAY_Z = 1100;

/** Zoom the locate button flies to: a few towns around you. */
const LOCATE_ZOOM = 10;

const insideIsrael = ({ lat, lng }: Coordinates) =>
  lat >= ISRAEL_PAN_LIMIT.south && lat <= ISRAEL_PAN_LIMIT.north && lng >= ISRAEL_PAN_LIMIT.west && lng <= ISRAEL_PAN_LIMIT.east;

/**
 * Dedicated Map tab. It shares Home's filter chips / search / sort
 * (`useSiteFilters`), so the pins are always the same set the list would
 * show, and the map zooms to them whenever a search or filter is active.
 *
 * Desktop: a results panel (filters + the sorted list) on the right, the map
 * filling the rest. Mobile: the map fills the screen and the search bar and
 * chips float over its top, as in map apps; the list itself is Home's job
 * (the list button goes there).
 *
 * Tapping a pin opens its card (SelectedSiteCard) at the bottom; tapping
 * the map closes it.
 */
export default function MapScreen() {
  const { campsites, loading } = useCampsites();
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const clearance = useBottomClearance();
  const router = useRouter();
  const filters = useSiteFilters(campsites);
  const distanceNote = useDistanceNote(filters);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Height of the floating search bar + chips, measured, so the map frames
  // the country below it rather than under it.
  const [overlayTop, setOverlayTop] = useState(0);

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  // Zoom to the results only once the visitor has narrowed them down;
  // the unfiltered map stays framed on the whole country.
  const isFiltered =
    filters.query.trim() !== "" || filters.sourceFilter !== "all" || filters.freeOnly || filters.regions.size > 0;

  // Sites without verified coordinates can't be pinned; say so rather than
  // silently showing fewer pins than there are results.
  const unmappable = filters.visible.filter((c) => !c.coordinates).length;

  const selected = useMemo(
    () => (selectedId ? filters.visible.find((c) => c.id === selectedId) ?? null : null),
    [filters.visible, selectedId]
  );
  // A filter that hides the selected site closes its card.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const position = await locate();
      if (!insideIsrael(position)) {
        setMessage(t("map.outsideIsrael"));
        return;
      }
      setUserLocation(position);
      setFocus({ ...position, zoom: LOCATE_ZOOM, key: Date.now() });
    } catch (error) {
      setMessage(t((error as LocateError) === "denied" ? "map.locateDenied" : "map.locateFailed"));
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const unmappableNote =
    unmappable > 0 ? (
      <View style={[styles.noteWrap, { pointerEvents: "none" }]}>
        {/* writingDirection: Paper's Text pins "ltr" on web, which moved
            the count to the wrong end of the Hebrew sentence. */}
        <Text variant="labelSmall" style={[styles.note, { writingDirection, textAlign: "center" }]}>
          {t("home.unmappableNote").replace("{count}", String(unmappable))}
        </Text>
      </View>
    ) : null;

  const locateButton = canLocate ? (
    <Pressable
      onPress={locateMe}
      disabled={locating}
      style={styles.fab}
      accessibilityRole="button"
      accessibilityLabel={t("map.locate")}
    >
      {locating ? (
        <ActivityIndicator size={18} color={colors.primary} />
      ) : (
        <MaterialCommunityIcons name="crosshairs-gps" size={21} color={colors.primary} />
      )}
    </Pressable>
  ) : null;

  const snackbar = (
    <Snackbar
      visible={!!message}
      onDismiss={() => setMessage(null)}
      duration={4000}
      wrapperStyle={{ bottom: isDesktop ? 0 : clearance - spacing.md }}
    >
      {message ?? ""}
    </Snackbar>
  );

  if (isDesktop) {
    // Under the app's fixed right-to-left layout the first child of a row
    // sits on the right, so the panel comes first.
    return (
      <View style={[styles.container, styles.row]}>
        <View style={styles.panel}>
          <SiteList
            campsites={filters.visible}
            onSelectCampsite={openCampsite}
            noteFor={distanceNote}
            header={
              <View style={styles.panelHeader}>
                <SiteFilterBar filters={filters} />
              </View>
            }
          />
        </View>
        <View style={styles.mapWrap}>
          <Map
            campsites={filters.visible}
            selectedId={selectedId}
            onPinPress={(campsite) => setSelectedId(campsite.id)}
            onMapPress={() => setSelectedId(null)}
            fitToCampsites={isFiltered}
            userLocation={userLocation}
            focus={focus}
          />
          {unmappableNote}
          <View style={[styles.fabColumn, { top: spacing.md, pointerEvents: "box-none" }]}>
            {locateButton}
          </View>
          {selected && (
            <View style={[styles.cardWrap, styles.cardWrapDesktop, { pointerEvents: "box-none" }]}>
              <SelectedSiteCard
                campsite={selected}
                onOpen={() => openCampsite(selected)}
                onClose={() => setSelectedId(null)}
              />
            </View>
          )}
          {snackbar}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map
        campsites={filters.visible}
        selectedId={selectedId}
        onPinPress={(campsite) => setSelectedId(campsite.id)}
        onMapPress={() => setSelectedId(null)}
        fitToCampsites={isFiltered}
        userLocation={userLocation}
        focus={focus}
        overlayInsets={{ top: overlayTop, bottom: clearance }}
      />
      {/* box-none: taps between the chips reach the map underneath. */}
      <View
        style={[styles.topOverlay, { pointerEvents: "box-none" }]}
        onLayout={(event) => setOverlayTop(event.nativeEvent.layout.height)}
      >
        <SiteFilterBar filters={filters} floating />
      </View>
      <View style={[styles.fabColumn, { top: overlayTop + spacing.sm, pointerEvents: "box-none" }]}>
        {locateButton}
        <Pressable
          onPress={() => router.push("/")}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t("map.showList")}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={21} color={colors.primary} />
        </Pressable>
      </View>
      {/* Beside the round buttons, not under them. */}
      {unmappableNote && (
        <View
          style={{ position: "absolute", zIndex: OVERLAY_Z, top: overlayTop - spacing.sm, left: 0, right: TOUCH_TARGET + spacing.md }}
        >
          {unmappableNote}
        </View>
      )}
      {selected && (
        <View style={[styles.cardWrap, { bottom: clearance, pointerEvents: "box-none" }]}>
          <SelectedSiteCard
            campsite={selected}
            onOpen={() => openCampsite(selected)}
            onClose={() => setSelectedId(null)}
          />
        </View>
      )}
      {snackbar}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: "center", justifyContent: "center" },
    row: { flexDirection: "row" },
    panel: {
      width: PANEL_WIDTH,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    panelHeader: { paddingBottom: spacing.md },
    mapWrap: { flex: 1 },
    // Leaflet's panes carry z-indexes up to 1000 of their own (web), so
    // everything floating over the map needs a higher one.
    topOverlay: {
      zIndex: OVERLAY_Z,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    // Physical right: the leading edge of the right-to-left layout, like a
    // map app's controls under the search bar.
    fabColumn: { zIndex: OVERLAY_Z, position: "absolute", right: spacing.md, gap: spacing.sm },
    fab: {
      width: TOUCH_TARGET + 4,
      height: TOUCH_TARGET + 4,
      borderRadius: (TOUCH_TARGET + 4) / 2,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    cardWrap: { zIndex: OVERLAY_Z, position: "absolute", left: spacing.md, right: spacing.md },
    cardWrapDesktop: { bottom: spacing.lg, left: undefined, right: spacing.lg, width: 380 },
    noteWrap: {
      zIndex: OVERLAY_Z,
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      alignItems: "center",
    },
    note: {
      backgroundColor: colors.surface,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
  });
}
