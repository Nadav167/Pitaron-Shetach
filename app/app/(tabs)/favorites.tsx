import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useFavorites } from "@/context/FavoritesContext";
import { useLocale } from "@/context/LocaleContext";
import SiteList from "@/components/SiteList";
import EmptyState from "@/components/EmptyState";
import { colors, spacing } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

export default function FavoritesScreen() {
  const { campsites } = useCampsites();
  const { favoriteIds } = useFavorites();
  const { t } = useLocale();
  const router = useRouter();

  const favorites = campsites.filter((campsite) => favoriteIds.has(campsite.id));
  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {t("favorites.title")}
      </Text>
      {favorites.length === 0 ? (
        <EmptyState message={t("favorites.empty")} />
      ) : (
        <SiteList campsites={favorites} onSelectCampsite={openCampsite} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { padding: spacing.md },
});
