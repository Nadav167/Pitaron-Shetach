import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Site } from "@/types/site";
import { useLocale } from "@/context/LocaleContext";
import { colors, radius, spacing, typography } from "@/constants/theme";

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
      : `₪${site.pricePerNight} ${t("common.perNight")}`;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.price}>{priceLabel}</Text>
      </View>
      <Text style={styles.region}>{site.region}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { ...typography.subtitle, color: colors.text, flexShrink: 1 },
  price: { ...typography.body, color: colors.primary, fontWeight: "700" },
  region: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
