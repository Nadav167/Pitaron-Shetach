import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSites } from "@/hooks/useSites";
import { useFavorites } from "@/context/FavoritesContext";
import { useLocale } from "@/context/LocaleContext";
import SiteList from "@/components/SiteList";
import EmptyState from "@/components/EmptyState";
import { colors, spacing } from "@/constants/theme";
import type { Site } from "@/types/site";

export default function FavoritesScreen() {
  const { sites } = useSites();
  const { favoriteIds } = useFavorites();
  const { t } = useLocale();
  const router = useRouter();

  const favoriteSites = sites.filter((site) => favoriteIds.has(site.id));
  const openSite = (site: Site) => router.push(`/site/${site.id}`);

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {t("favorites.title")}
      </Text>
      {favoriteSites.length === 0 ? (
        <EmptyState message={t("favorites.empty")} />
      ) : (
        <SiteList sites={favoriteSites} onSelectSite={openSite} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { padding: spacing.md },
});
