import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useDistanceNote, useSiteFilters } from "@/hooks/useSiteFilters";
import { useFavorites } from "@/context/FavoritesContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import SiteList from "@/components/SiteList";
import SiteFilterBar from "@/components/SiteFilterBar";
import EmptyState from "@/components/EmptyState";
import { spacing, fonts, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

export default function FavoritesScreen() {
  const { campsites } = useCampsites();
  const { favoriteIds } = useFavorites();
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const favorites = useMemo(
    () => campsites.filter((campsite) => favoriteIds.has(campsite.id)),
    [campsites, favoriteIds]
  );
  // Same chips / search / sort as Home, applied to the saved sites only.
  const filters = useSiteFilters(favorites);
  const distanceNote = useDistanceNote(filters);
  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const title = (
    <Text variant="headlineSmall" style={styles.title}>
      {t("favorites.title")}
    </Text>
  );

  // Nothing saved yet: filter controls over an empty list would only be
  // noise, so this state shows the explanation by itself.
  if (favorites.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.titleOnly}>{title}</View>
        <EmptyState message={t("favorites.empty")} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* `contentMaxWidth` (not an outer maxWidth View) keeps the FlatList
          itself full-width so its native scrollbar stays at the true edge
          of the window — see SiteList.tsx. */}
      <SiteList
        campsites={filters.visible}
        onSelectCampsite={openCampsite}
        numColumns={isDesktop ? 3 : 1}
        contentMaxWidth={isDesktop ? 1200 : undefined}
        emptyMessage={t("favorites.noMatches")}
        noteFor={distanceNote}
        header={
          <View style={styles.header}>
            {title}
            <SiteFilterBar filters={filters} centered={isDesktop} />
          </View>
        }
      />
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    titleOnly: { padding: spacing.md },
    header: { paddingBottom: spacing.md },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless of
    // RTL -- override explicitly (same fix as the detail screen).
    title: {
      paddingBottom: spacing.md,
      fontFamily: fonts.display,
      color: colors.text,
      textAlign: "right",
      writingDirection,
    },
  });
}
