import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { localized } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import CampsiteCover from "@/components/CampsiteCover";
import FavoriteButton from "@/components/FavoriteButton";
import { cardFacts } from "@/lib/campsiteText";
import { openNavigation } from "@/lib/navigation";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

type Props = {
  campsite: Campsite;
  onOpen: () => void;
  onClose: () => void;
};

/**
 * The card a tapped map pin opens, floating at the bottom of the map: photo, name,
 * region · price, and the two things people want from the map, navigating
 * there (Waze) and the full details. Replaces the Leaflet popup and the
 * native Callout, so web and native behave alike and every control is a
 * full-size touch target.
 */
export default function SelectedSiteCard({ campsite, onOpen, onClose }: Props) {
  const { t, locale, writingDirection } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);
  const name = localized(campsite.name, locale);
  const { price, hours } = cardFacts(campsite, t, locale);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.main}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t(`region.${campsite.region}`)}, ${price}`}
        accessibilityHint={t("site.viewDetails")}
      >
        <CampsiteCover campsite={campsite} style={styles.thumb} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[campsite.closed && t("site.closed"), t(`region.${campsite.region}`), price].filter(Boolean).join(" · ")}
          </Text>
          {hours ? (
            <Text style={styles.meta} numberOfLines={1}>
              {hours}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.side}>
        <Pressable onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t("common.close")}>
          <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
        </Pressable>
        <FavoriteButton campsiteId={campsite.id} variant="plain" />
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => openNavigation(campsite, "waze")}
          style={[styles.action, styles.actionPrimary]}
          accessibilityRole="button"
          accessibilityLabel={`${t("site.navigateWaze")} – ${name}`}
        >
          <MaterialCommunityIcons name="navigation-variant-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.actionPrimaryText}>{t("site.navigateWaze")}</Text>
        </Pressable>
        <Pressable onPress={onOpen} style={[styles.action, styles.actionSecondary]} accessibilityRole="button">
          <Text style={styles.actionSecondaryText}>{t("site.viewDetails")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: spacing.sm + 2,
      gap: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    main: { flex: 1, minWidth: 0, flexDirection: "row", gap: 12, alignItems: "center" },
    thumb: { width: 76, height: 76, aspectRatio: undefined, borderRadius: 14, overflow: "hidden" },
    body: { flex: 1, minWidth: 0, gap: 3 },
    name: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 21, color: colors.text, ...text },
    meta: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, ...text },
    side: { alignItems: "center", marginTop: -6, marginEnd: -6 },
    iconButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
    actions: { flexDirection: "row", gap: spacing.sm, width: "100%" },
    action: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      gap: 6,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPrimary: { backgroundColor: colors.primary },
    actionPrimaryText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.onPrimary },
    actionSecondary: { backgroundColor: colors.primaryTint },
    actionSecondaryText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.primary },
  });
}
