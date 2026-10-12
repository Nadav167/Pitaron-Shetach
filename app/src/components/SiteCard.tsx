import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import { spacing, radius, fonts, type ColorTokens } from "@/constants/theme";

type Props = {
  campsite: Campsite;
  onPress?: () => void;
};

/**
 * Rich, photo-forward card: cover photo with a favorite toggle, name,
 * region + price, hours, and a single "Details" button into the full
 * detail screen — that's also where the Waze/Google Maps links live now,
 * rather than duplicated on every card. Official/non-official sites look
 * the same here on purpose; the distinction lives in the filter chips and
 * the detail screen, not as a badge on every listing.
 */
export default function SiteCard({ campsite, onPress }: Props) {
  const { locale, t, isRTL } = useLocale();
  const colors = useThemeColors();
  const { isFavorite, toggleFavorite } = useFavorites();
  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);

  const name = localized(campsite.name, locale);
  const priceLabel = campsite.pricing.isFree
    ? t("common.free")
    : campsite.pricing.perNight != null
    ? `₪${campsite.pricing.perNight} ${t("common.perNight")}`
    : t("common.priceUnknown");

  // Stock images the source captioned "illustration only" are not shown as
  // if they documented the place — the card falls back to no cover instead.
  const cover = campsite.photos.find((photo) => !photo.isPlaceholder);
  const favorite = isFavorite(campsite.id);
  const chevron = isRTL ? "chevron-left" : "chevron-right";

  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      {cover && (
        <View style={styles.coverWrap}>
          <Card.Cover source={{ uri: cover.url }} style={styles.cover} />
          <Pressable
            style={styles.heartButton}
            hitSlop={8}
            onPress={() => toggleFavorite(campsite.id)}
            accessibilityLabel={favorite ? t("site.removeFromFavorites") : t("site.addToFavorites")}
          >
            <MaterialCommunityIcons name={favorite ? "heart" : "heart-outline"} size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
      <Card.Content style={styles.content}>
        <Text variant="titleMedium" style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="map-marker" size={14} color={colors.textMuted} />
            <Text variant="bodySmall" style={styles.muted}>
              {t(`region.${campsite.region}`)}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.price}>
            {priceLabel}
          </Text>
        </View>

        {campsite.openingHours.note ? (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
            <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
              {campsite.openingHours.note}
            </Text>
          </View>
        ) : null}

        {!campsite.coordinates && (
          <Text variant="labelSmall" style={styles.noCoords}>
            {t("site.noCoordinates")}
          </Text>
        )}

        <Pressable style={styles.detailsButton} onPress={onPress}>
          <Text style={styles.detailsLabel}>{t("site.viewDetails")}</Text>
          <MaterialCommunityIcons name={chevron} size={16} color={colors.onPrimary} />
        </Pressable>
      </Card.Content>
    </Card>
  );
}

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  return StyleSheet.create({
    card: { marginBottom: spacing.md, borderRadius: radius.lg, overflow: "hidden" },
    coverWrap: { position: "relative" },
    // 16:9, matching the mockup's photo proportions — a fixed short height
    // regardless of card width (the previous 150px) made the photo look
    // like a thin stretched banner on wide cards instead of a proper photo.
    cover: { width: "100%", aspectRatio: 16 / 9, borderRadius: 0 },
    heartButton: {
      position: "absolute",
      top: 10,
      // Absolute left/right positioning doesn't mirror automatically under
      // RTL (unlike flow-relative flex layout) — has to be flipped by hand.
      ...(isRTL ? { left: 10 } : { right: 10 }),
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(17,24,20,0.38)",
      alignItems: "center",
      justifyContent: "center",
    },
    content: { paddingTop: spacing.md, gap: spacing.xs },
    // react-native-paper's own <Text> component hardcodes
    // `textAlign: 'left'` unconditionally (see Typography/Text.tsx) --
    // it never mirrors under RTL on its own, so every Paper Text here
    // needs an explicit override or Hebrew titles stay flush left.
    name: { fontFamily: fonts.displayBold, color: colors.text, textAlign: isRTL ? "right" : "left" },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    muted: { color: colors.textMuted },
    price: { color: colors.accentDeep, fontFamily: fonts.bodyBold },
    noCoords: { color: colors.textMuted, fontStyle: "italic", textAlign: isRTL ? "right" : "left" },
    detailsButton: {
      marginTop: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    detailsLabel: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  });
}
