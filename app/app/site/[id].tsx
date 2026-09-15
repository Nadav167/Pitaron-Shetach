import React from "react";
import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Appbar, Button, Chip, Divider, List, Text } from "react-native-paper";
import { useCampsite } from "@/hooks/useSite";
import { useLocale } from "@/context/LocaleContext";
import { useFavorites } from "@/context/FavoritesContext";
import { colors, radius, spacing } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import UnofficialNotice from "@/components/UnofficialNotice";
import NavigationButtons from "@/components/NavigationButtons";
import { localized, type Amenities } from "@/types/campsite";

export default function CampsiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campsite, loading, error } = useCampsite(id);
  const { locale, t } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();

  const name = campsite ? localized(campsite.name, locale) : "";
  const description = campsite?.description ? localized(campsite.description, locale) : "";
  const favorite = campsite ? isFavorite(campsite.id) : false;

  // An amenity key that's absent means "unknown", not "absent" — only keys the
  // scraper positively confirmed are shown.
  const knownAmenities = campsite
    ? (Object.entries(campsite.amenities) as [keyof Amenities, boolean | undefined][]).filter(
        ([, enabled]) => enabled === true
      )
    : [];

  const cover = campsite?.photos.find((photo) => !photo.isPlaceholder);
  const placeholderOnly = !cover && (campsite?.photos.length ?? 0) > 0;

  const priceLabel = !campsite
    ? ""
    : campsite.pricing.isFree
    ? t("common.free")
    : campsite.pricing.perNight != null
    ? `₪${campsite.pricing.perNight} ${t("common.perNight")}`
    : t("common.priceUnknown");

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar} elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={name} />
        {campsite && (
          <Appbar.Action
            icon={favorite ? "heart" : "heart-outline"}
            iconColor={favorite ? colors.danger : colors.text}
            onPress={() => toggleFavorite(campsite.id)}
          />
        )}
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !campsite ? (
        <EmptyState message={error ?? t("common.error")} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {cover && <Image source={{ uri: cover.url }} style={styles.cover} resizeMode="cover" />}
          {placeholderOnly && (
            <Text variant="labelSmall" style={styles.muted}>
              {t("site.photoPlaceholderOnly")}
            </Text>
          )}

          {!campsite.isOfficial && <UnofficialNotice variant="full" />}

          {campsite.isOfficial && (
            <Chip icon="shield-check" style={styles.officialChip} mode="flat">
              {t("site.officialLong")}
            </Chip>
          )}

          {description ? (
            <Text variant="bodyMedium" style={styles.description}>
              {description}
            </Text>
          ) : null}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t("site.navigate")}
          </Text>
          <NavigationButtons campsite={campsite} size="full" />
          {!campsite.coordinates && (
            <Text variant="labelSmall" style={styles.noCoords}>
              {t("site.noCoordinatesLong")}
            </Text>
          )}

          <Button
            mode={favorite ? "outlined" : "contained"}
            icon={favorite ? "heart-off-outline" : "heart-outline"}
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(campsite.id)}
          >
            {favorite ? t("site.removeFromFavorites") : t("site.addToFavorites")}
          </Button>

          <Divider />

          <List.Section>
            <List.Item
              title={t("site.price")}
              description={
                campsite.pricing.note ? `${priceLabel} — ${campsite.pricing.note}` : priceLabel
              }
              descriptionNumberOfLines={3}
              left={(props) => <List.Icon {...props} icon="cash-multiple" />}
            />
            <List.Item
              title={t("site.region")}
              description={t(`region.${campsite.region}`)}
              left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
            />
            <List.Item
              title={t("site.openingHours")}
              description={campsite.openingHours.note ?? t("common.unknown")}
              descriptionNumberOfLines={4}
              left={(props) => <List.Icon {...props} icon="clock-outline" />}
            />
            {(campsite.openingHours.checkIn || campsite.openingHours.checkOut) && (
              <List.Item
                title={t("site.checkInOut")}
                description={[
                  campsite.openingHours.checkIn && `${t("site.checkIn")}: ${campsite.openingHours.checkIn}`,
                  campsite.openingHours.checkOut && `${t("site.checkOut")}: ${campsite.openingHours.checkOut}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                left={(props) => <List.Icon {...props} icon="login-variant" />}
              />
            )}
          </List.Section>

          {knownAmenities.length > 0 && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t("site.amenities")}
              </Text>
              <View style={styles.chipRow}>
                {knownAmenities.map(([key]) => (
                  <Chip key={key} style={styles.chip} icon="check-circle-outline">
                    {t(`site.amenity.${key}`)}
                  </Chip>
                ))}
              </View>
            </>
          )}

          {(campsite.contact.phone || campsite.contact.website || campsite.contact.email) && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t("site.contact")}
              </Text>
              <List.Section>
                {campsite.contact.phone && (
                  <List.Item
                    title={campsite.contact.phone}
                    left={(props) => <List.Icon {...props} icon="phone-outline" />}
                    onPress={() => Linking.openURL(`tel:${campsite.contact.phone}`)}
                  />
                )}
                {campsite.contact.website && (
                  <List.Item
                    title={t("site.sourcePage")}
                    description={campsite.source.name}
                    left={(props) => <List.Icon {...props} icon="web" />}
                    onPress={() => Linking.openURL(campsite.contact.website!)}
                  />
                )}
                {campsite.contact.email && (
                  <List.Item
                    title={campsite.contact.email}
                    left={(props) => <List.Icon {...props} icon="email-outline" />}
                    onPress={() => Linking.openURL(`mailto:${campsite.contact.email}`)}
                  />
                )}
              </List.Section>
            </>
          )}

          {/* Provenance. Scraped data goes stale and occasionally lands a pin in
              the wrong place; showing where a record came from lets someone
              check the source rather than trust us blindly. */}
          <Divider style={styles.divider} />
          <Text variant="labelSmall" style={styles.muted}>
            {`${t("site.dataFrom")}: ${campsite.source.name}`}
          </Text>
          {campsite.source.coordsSource && (
            <Text variant="labelSmall" style={styles.muted}>
              {`${t("site.coordsFrom")}: ${campsite.source.coordsSource}`}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appbar: { backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  cover: { width: "100%", height: 200, borderRadius: radius.md },
  officialChip: { alignSelf: "flex-start" },
  description: { color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { marginTop: spacing.md },
  favoriteButton: { marginVertical: spacing.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { marginBottom: spacing.xs },
  muted: { color: colors.textMuted },
  noCoords: { color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  divider: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
