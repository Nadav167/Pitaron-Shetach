import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useDistanceNote, useSiteFilters } from "@/hooks/useSiteFilters";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import Map from "@/components/Map";
import SiteList from "@/components/SiteList";
import SiteFilterBar from "@/components/SiteFilterBar";
import { spacing, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

/** Width of the desktop results panel beside the map. */
const PANEL_WIDTH = 400;

/**
 * Dedicated Map tab. It shares Home's filter chips / search / sort
 * (`useSiteFilters`), so the pins are always the same set the list would
 * show, and the map zooms to them whenever a search or filter is active.
 *
 * Desktop: a results panel (filters + the sorted list) on the right, the map
 * filling the rest. Mobile: the filter bar above a full-width map; the list
 * itself is Home's job there.
 */
export default function MapScreen() {
  const { campsites, loading } = useCampsites();
  const { t } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const filters = useSiteFilters(campsites);
  const distanceNote = useDistanceNote(filters);

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  // Zoom to the results only once the visitor has narrowed them down;
  // the unfiltered map stays framed on the whole country.
  const isFiltered = filters.query.trim() !== "" || filters.sourceFilter !== "all";

  // Sites without verified coordinates can't be pinned; say so rather than
  // silently showing fewer pins than there are results.
  const unmappable = filters.visible.filter((c) => !c.coordinates).length;

  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const map = (
    <View style={styles.mapWrap}>
      <Map campsites={filters.visible} onSelectCampsite={openCampsite} fitToCampsites={isFiltered} />
      {unmappable > 0 && (
        <View style={styles.noteWrap} pointerEvents="none">
          <Text variant="labelSmall" style={styles.note}>
            {t("home.unmappableNote").replace("{count}", String(unmappable))}
          </Text>
        </View>
      )}
    </View>
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
        {map}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mobileFilters}>
        <SiteFilterBar filters={filters} />
      </View>
      {map}
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
    mobileFilters: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    mapWrap: { flex: 1 },
    noteWrap: {
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
      borderRadius: 999,
      overflow: "hidden",
    },
  });
}
