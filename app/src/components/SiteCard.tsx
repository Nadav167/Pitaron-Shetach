import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text } from "react-native-paper";
import { Site } from "@/types/site";
import { useLocale } from "@/context/LocaleContext";
import { spacing } from "@/constants/theme";

type Props = {
  site: Site;
  onPress?: () => void;
};

export default function SiteCard({ site, onPress }: Props) {
  const { locale, t } = useLocale();
  const name = site.translations[locale]?.name ?? site.translations.he.name;
  const priceLabel =
    site.pricePerNight === null || site.pricePerNight === 0
      ? t("common.free")
      : `₪${site.pricePerNight}`;

  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Chip compact mode="flat" style={styles.priceChip} textStyle={styles.priceChipText}>
            {priceLabel}
          </Chip>
        </View>
        <Text variant="bodySmall" style={styles.region}>
          {site.region}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { flexShrink: 1 },
  priceChip: {},
  priceChipText: { fontWeight: "700" },
  region: { marginTop: spacing.xs },
});
