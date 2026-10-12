import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCampsites } from "@/hooks/useSites";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import SiteList from "@/components/SiteList";
import SearchBar from "@/components/SearchBar";
import FilterChip from "@/components/FilterChip";
import { sortCampsites, type SortMode } from "@/lib/sort";
import { spacing, fonts, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";

type SourceFilter = "all" | "official" | "unofficial";

// Official sites are the Nature and Parks Authority's night PARKING grounds;
// non-official sites are the community CAMPING directory — that's the
// distinction people actually search by, so the filter chips are labeled
// that way rather than "official/non-official". Icons match the mockup's
// filter_chips() spec: no icon for "all", a pin for parking, a tent for
// camping.
const FILTER_ICON: Record<SourceFilter, string | undefined> = {
  all: undefined,
  official: "map-marker",
  unofficial: "tent",
};

export default function HomeScreen() {
  const { campsites, loading } = useCampsites();
  const { locale, t, isRTL } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  const visible = useMemo(() => {
    let list = campsites;
    if (sourceFilter === "official") list = list.filter((c) => c.isOfficial);
    else if (sourceFilter === "unofficial") list = list.filter((c) => !c.isOfficial);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => localized(c.name, locale).toLowerCase().includes(q));
    }
    return sortCampsites(list, sortMode);
  }, [campsites, sourceFilter, query, locale, sortMode]);

  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);

  const chips = (
    <View style={[styles.filterRow, isDesktop && styles.filterRowCentered]}>
      {(["all", "unofficial", "official"] as SourceFilter[]).map((filter) => (
        <FilterChip
          key={filter}
          label={t(`home.filter.${filter}`)}
          icon={FILTER_ICON[filter]}
          selected={sourceFilter === filter}
          onPress={() => setSourceFilter(filter)}
        />
      ))}
    </View>
  );

  const search = <SearchBar value={query} onChangeText={setQuery} sortMode={sortMode} onSortModeChange={setSortMode} />;

  const header = isDesktop ? (
    <View style={styles.desktopHero}>
      <Text style={styles.desktopTitle}>{t("home.title")}</Text>
      <Text variant="bodyMedium" style={styles.desktopSubtitle}>
        {t("home.subtitle")}
      </Text>
      <View style={styles.desktopSearchWrap}>{search}</View>
      {chips}
    </View>
  ) : (
    <View style={styles.mobileHeader}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="pine-tree" size={15} color={colors.onPrimary} />
        </View>
        <Text style={styles.brandName}>{t("common.appName")}</Text>
      </View>
      <Text style={styles.mobileTitle}>{t("home.title")}</Text>
      <View style={styles.mobileSearchWrap}>{search}</View>
      {chips}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.fill}>
          <SiteList
            campsites={visible}
            onSelectCampsite={openCampsite}
            numColumns={isDesktop ? 3 : 1}
            header={header}
            contentMaxWidth={isDesktop ? 1200 : undefined}
          />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  const align = isRTL ? ("right" as const) : ("left" as const);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    fill: { flex: 1 },
    // The 1200px-max centering itself now lives on SiteList's own
    // `contentMaxWidth` prop (applied to the FlatList's content, not this
    // wrapper) — see SiteList.tsx for why: capping this outer View instead
    // used to also cap the *scrollable* element, leaving the native
    // scrollbar stuck at the edge of a centered box instead of the true
    // edge of the browser window.

    // Mobile header: brand row + big title + search + chips, matching the
    // mockup's mobile Home artboard (the first real-app pass only had a
    // plain title/subtitle here, no brand row and no search bar at all).
    mobileHeader: { padding: spacing.md, paddingBottom: 0 },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: spacing.md },
    brandMark: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless
    // of RTL -- override explicitly (same fix as the detail screen).
    brandName: { fontFamily: fonts.display, fontSize: 13, color: colors.text, textAlign: align },
    mobileTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginBottom: spacing.md, textAlign: align },
    mobileSearchWrap: { marginBottom: spacing.md },

    // Desktop hero: centered title/subtitle/search/chips above a 3-column
    // grid, matching the mockup's Home-Desktop artboard.
    desktopHero: { alignItems: "center", padding: spacing.xl, paddingBottom: spacing.md },
    desktopTitle: {
      fontFamily: fonts.display,
      fontSize: 34,
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    desktopSubtitle: { color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
    desktopSearchWrap: { width: "100%", maxWidth: 560, marginBottom: spacing.md },

    filterRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    filterRowCentered: { justifyContent: "center" },
  });
}
