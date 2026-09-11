import React from "react";
import { ScrollView, StyleSheet, Text, View, Linking, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSite } from "@/hooks/useSite";
import { useLocale } from "@/context/LocaleContext";
import { useFavorites } from "@/context/FavoritesContext";
import { colors, radius, spacing, typography } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import type { Amenities } from "@/types/site";

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { site, loading, error } = useSite(id);
  const { locale, t } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!site) {
    return <EmptyState message={error ?? t("common.error")} />;
  }

  const translation = site.translations[locale] ?? site.translations.he;
  const favorite = isFavorite(site.id);
  const amenityEntries = Object.entries(site.amenities) as [keyof Amenities, boolean][];
  const activeAmenities = amenityEntries.filter(([, enabled]) => enabled);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translation.name}</Text>
      {translation.description ? <Text style={styles.description}>{translation.description}</Text> : null}

      <Pressable onPress={() => toggleFavorite(site.id)} style={styles.favoriteButton}>
        <Text style={styles.favoriteButtonText}>
          {favorite ? t("site.removeFromFavorites") : t("site.addToFavorites")}
        </Text>
      </Pressable>

      <Section title={t("site.price")}>
        <Text style={styles.value}>
          {site.pricePerNight ? `₪${site.pricePerNight} ${t("common.perNight")}` : t("common.free")}
        </Text>
      </Section>

      <Section title={t("site.region")}>
        <Text style={styles.value}>{site.region}</Text>
      </Section>

      <Section title={t("site.openingHours")}>
        <Text style={styles.value}>{site.openingHours.note ?? "-"}</Text>
      </Section>

      <Section title={t("site.amenities")}>
        {activeAmenities.length === 0 ? (
          <Text style={styles.value}>-</Text>
        ) : (
          activeAmenities.map(([key]) => (
            <Text key={key} style={styles.amenity}>
              • {t(`site.amenity.${key}`)}
            </Text>
          ))
        )}
      </Section>

      {(site.contact.phone || site.contact.website || site.contact.email) && (
        <Section title={t("site.contact")}>
          {site.contact.phone && (
            <Text style={styles.link} onPress={() => Linking.openURL(`tel:${site.contact.phone}`)}>
              {site.contact.phone}
            </Text>
          )}
          {site.contact.website && (
            <Text style={styles.link} onPress={() => Linking.openURL(site.contact.website!)}>
              {site.contact.website}
            </Text>
          )}
          {site.contact.email && (
            <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${site.contact.email}`)}>
              {site.contact.email}
            </Text>
          )}
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  favoriteButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  favoriteButtonText: { color: colors.surface, fontWeight: "700" },
  section: { marginTop: spacing.lg },
  sectionTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.textMuted },
  amenity: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary, marginTop: spacing.xs },
});
