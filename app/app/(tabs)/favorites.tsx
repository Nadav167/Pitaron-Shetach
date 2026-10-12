import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useFavorites } from "@/context/FavoritesContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import SiteList from "@/components/SiteList";
import EmptyState from "@/components/EmptyState";
import { spacing, fonts, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

export default function FavoritesScreen() {
  const { campsites } = useCampsites();
  const { favoriteIds } = useFavorites();
  const { t, isRTL } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const favorites = campsites.filter((campsite) => favoriteIds.has(campsite.id));
  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);

  const title = (
    <Text variant="headlineSmall" style={styles.title}>
      {t("favorites.title")}
    </Text>
  );

  return (
    <View style={styles.container}>
      {favorites.length === 0 ? (
        <View style={styles.fill}>
          {title}
          <EmptyState message={t("favorites.empty")} />
        </View>
      ) : (
        // `contentMaxWidth` (not an outer maxWidth View) keeps the
        // FlatList itself full-width so its native scrollbar stays at the
        // true edge of the window — see SiteList.tsx.
        <SiteList
          campsites={favorites}
          onSelectCampsite={openCampsite}
          header={title}
          contentMaxWidth={isDesktop ? 900 : undefined}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless of
    // RTL -- override explicitly (same fix as the detail screen).
    title: { padding: spacing.md, fontFamily: fonts.display, color: colors.text, textAlign: isRTL ? "right" : "left" },
  });
}
