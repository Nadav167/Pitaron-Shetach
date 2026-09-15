import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text } from "react-native-paper";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { colors, spacing } from "@/constants/theme";
import UnofficialNotice from "./UnofficialNotice";
import NavigationButtons from "./NavigationButtons";

type Props = {
  campsite: Campsite;
  onPress?: () => void;
};

export default function SiteCard({ campsite, onPress }: Props) {
  const { locale, t } = useLocale();

  const name = localized(campsite.name, locale);
  const priceLabel = campsite.pricing.isFree
    ? t("common.free")
    : campsite.pricing.perNight != null
    ? `₪${campsite.pricing.perNight}`
    : t("common.priceUnknown");

  // Stock images the source captioned "illustration only" are not shown as
  // if they documented the place — the card falls back to no cover instead.
  const cover = campsite.photos.find((photo) => !photo.isPlaceholder);

  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      {cover && <Card.Cover source={{ uri: cover.url }} style={styles.cover} />}
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Chip compact mode="flat" style={styles.priceChip} textStyle={styles.priceChipText}>
            {priceLabel}
          </Chip>
        </View>

        <View style={styles.metaRow}>
          <Text variant="bodySmall" style={styles.muted}>
            {t(`region.${campsite.region}`)}
          </Text>
          {campsite.isOfficial && (
            <Chip compact mode="outlined" icon="shield-check" style={styles.officialChip}>
              {t("site.official")}
            </Chip>
          )}
        </View>

        {!campsite.isOfficial && <UnofficialNotice />}

        {!campsite.coordinates && (
          <Text variant="labelSmall" style={styles.noCoords}>
            {t("site.noCoordinates")}
          </Text>
        )}

        <View style={styles.actions}>
          <NavigationButtons campsite={campsite} size="compact" />
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cover: { height: 140 },
  content: { paddingTop: spacing.md, gap: spacing.xs },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  name: { flexShrink: 1 },
  priceChip: {},
  priceChipText: { fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  officialChip: { height: 26 },
  muted: { color: colors.textMuted },
  noCoords: { color: colors.textMuted, fontStyle: "italic" },
  actions: { marginTop: spacing.sm },
});
