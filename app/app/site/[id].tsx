import React from "react";
import { ScrollView, StyleSheet, View, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Appbar, Button, Chip, List, Text } from "react-native-paper";
import { useSite } from "@/hooks/useSite";
import { useLocale } from "@/context/LocaleContext";
import { useFavorites } from "@/context/FavoritesContext";
import { colors, spacing } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import type { Amenities } from "@/types/site";

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { site, loading, error } = useSite(id);
  const { locale, t } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();

  const translation = site?.translations[locale] ?? site?.translations.he;
  const favorite = site ? isFavorite(site.id) : false;
  const amenityEntries = site ? (Object.entries(site.amenities) as [keyof Amenities, boolean][]) : [];
  const activeAmenities = amenityEntries.filter(([, enabled]) => enabled);

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={translation?.name ?? ""} />
        {site && (
          <Appbar.Action
            icon={favorite ? "heart" : "heart-outline"}
            iconColor={favorite ? colors.danger : colors.text}
            onPress={() => toggleFavorite(site.id)}
          />
        )}
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !site || !translation ? (
        <EmptyState message={error ?? t("common.error")} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {translation.description ? (
            <Text variant="bodyMedium" style={styles.description}>
              {translation.description}
            </Text>
          ) : null}

          <Button
            mode={favorite ? "outlined" : "contained"}
            icon={favorite ? "heart-off-outline" : "heart-outline"}
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(site.id)}
          >
            {favorite ? t("site.removeFromFavorites") : t("site.addToFavorites")}
          </Button>

          <List.Section>
            <List.Item
              title={t("site.price")}
              description={site.pricePerNight ? `₪${site.pricePerNight} ${t("common.perNight")}` : t("common.free")}
              left={(props) => <List.Icon {...props} icon="cash-multiple" />}
            />
            <List.Item
              title={t("site.region")}
              description={site.region}
              left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
            />
            <List.Item
              title={t("site.openingHours")}
              description={site.openingHours.note ?? "-"}
              left={(props) => <List.Icon {...props} icon="clock-outline" />}
            />
          </List.Section>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t("site.amenities")}
          </Text>
          <View style={styles.chipRow}>
            {activeAmenities.length === 0 ? (
              <Text variant="bodyMedium" style={styles.muted}>
                -
              </Text>
            ) : (
              activeAmenities.map(([key]) => (
                <Chip key={key} style={styles.chip} icon="check-circle-outline">
                  {t(`site.amenity.${key}`)}
                </Chip>
              ))
            )}
          </View>

          {(site.contact.phone || site.contact.website || site.contact.email) && (
            <List.Section>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t("site.contact")}
              </Text>
              {site.contact.phone && (
                <List.Item
                  title={site.contact.phone}
                  left={(props) => <List.Icon {...props} icon="phone-outline" />}
                  onPress={() => Linking.openURL(`tel:${site.contact.phone}`)}
                />
              )}
              {site.contact.website && (
                <List.Item
                  title={site.contact.website}
                  left={(props) => <List.Icon {...props} icon="web" />}
                  onPress={() => Linking.openURL(site.contact.website!)}
                />
              )}
              {site.contact.email && (
                <List.Item
                  title={site.contact.email}
                  left={(props) => <List.Icon {...props} icon="email-outline" />}
                  onPress={() => Linking.openURL(`mailto:${site.contact.email}`)}
                />
              )}
            </List.Section>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appbar: { backgroundColor: colors.background },
  content: { padding: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  description: { color: colors.textMuted, marginBottom: spacing.md },
  favoriteButton: { marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { marginBottom: spacing.xs },
  muted: { color: colors.textMuted },
});
