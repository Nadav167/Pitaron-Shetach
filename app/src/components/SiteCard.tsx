import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { isNightCamp, localized } from "@/types/campsite";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import CampsiteCover from "@/components/CampsiteCover";
import FavoriteButton from "@/components/FavoriteButton";
import { cardFacts } from "@/lib/campsiteText";
import { PIN_GLYPH } from "@/constants/map";
import { spacing, radius, fonts, type ColorTokens } from "@/constants/theme";

type Props = {
  campsite: Campsite;
  /** Extra line under the region, e.g. the distance from a searched town. */
  note?: string;
  onPress?: () => void;
  /**
   * `photo`: cover photo on top (2:1), details below. `compact`: a single
   * row with a small tinted tile, for sites that have no photo of their
   * own in a one-column list: 150 of the 405 sites, which as full-size
   * cards were long runs of the same generic illustration.
   */
  variant?: "photo" | "compact";
};

/**
 * A campsite in a list. The whole card is one button into the detail screen
 * (it used to also carry a full-width "Details" button, a second tab stop
 * with the same action that cost ~56px per card); the heart is the only
 * other control. Waze/Google Maps live on the detail screen.
 */
export default function SiteCard({ campsite, note, onPress, variant = "photo" }: Props) {
  const { locale, t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const name = localized(campsite.name, locale);
  const { price, amenities } = cardFacts(campsite, t, locale);
  const region = t(`region.${campsite.region}`);
  const nightCamp = isNightCamp(campsite);
  const kindLabel = t(nightCamp ? "site.kind.nightCamp" : "site.kind.campground");
  // One sentence for screen readers instead of every fragment separately.
  const a11yLabel = [name, kindLabel, region, price, note].filter(Boolean).join(", ");

  // EVERY card has the same fixed set of lines, so all cards are the same
  // size and a grid row lines up: the name on one line (the full name is in
  // the accessibility label and on the site page), then one detail line.
  // The detail line is location only (Nadav 2026-10-23): the region, plus
  // the distance from a searched town when there is one. Hours notes used
  // to fill it too, and a long one ("עדכון 10.10.2023: הפארק סגור...") read
  // like the start of a description, cut off mid-sentence. An extra
  // line on some cards was what made one card in a grid row taller than its
  // neighbours. (Cards no longer flag "location not verified": Nadav
  // 2026-10-23. The site page still says so, next to the navigation.)
  const detail = note;
  const detailLine = (style: object) =>
    note ? (
      <View style={styles.metaItem}>
        <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.primary} />
        <Text style={styles.note} numberOfLines={1}>
          {note}
        </Text>
      </View>
    ) : detail ? (
      <Text style={style} numberOfLines={1}>
        {detail}
      </Text>
    ) : null;

  // The heart is a SIBLING of the card's main button, never inside it: on
  // web a Pressable is a <button>, and a <button> inside a <button> is
  // invalid HTML (React warned about it) that screen readers and keyboard
  // focus handle badly.
  if (variant === "compact") {
    return (
      <View style={[styles.card, styles.compactCard]}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.compactMain, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
        >
          <View style={[styles.tile, { backgroundColor: nightCamp ? colors.primaryTint : colors.accentTint }]}>
            <MaterialCommunityIcons
              name={nightCamp ? PIN_GLYPH.official : PIN_GLYPH.unofficial}
              size={28}
              color={nightCamp ? colors.primary : colors.accentDeep}
            />
          </View>
          <View style={styles.compactBody}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[region, price].join(" · ")}
            </Text>
            {/* At most three short lines: never taller than the 72px tile,
                so every compact row is the same 92px. */}
            {detail ? detailLine(styles.meta) : null}
          </View>
        </Pressable>
        <FavoriteButton campsiteId={campsite.id} variant="plain" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
      >
        <View>
          <CampsiteCover campsite={campsite} style={styles.cover} />
          <View style={styles.kindBadge}>
            <MaterialCommunityIcons name={nightCamp ? PIN_GLYPH.official : PIN_GLYPH.unofficial} size={13} color="#FFFFFF" />
            <Text style={styles.kindText}>{kindLabel}</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, styles.flex]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.price}>{price}</Text>
          </View>
          <View style={styles.titleRow}>
            <View style={[styles.flex, styles.metaItem]}>
              <Text style={[styles.meta, styles.metaRegion]} numberOfLines={1}>
                {detail ? `${region} ·` : region}
              </Text>
              {detailLine([styles.meta, styles.flex])}
            </View>
            {amenities.length > 0 && (
              <View style={styles.amenities} accessibilityLabel={amenities.map((a) => a.label).join(", ")}>
                {amenities.slice(0, 4).map((amenity) => (
                  <MaterialCommunityIcons key={amenity.key} name={amenity.icon} size={16} color={colors.primaryLight} />
                ))}
              </View>
            )}
          </View>
        </View>
      </Pressable>
      {/* Top-left corner of the photo: the trailing corner of the
          right-to-left layout. Absolute left/right doesn't mirror by itself
          the way flex rows do, and it must not move when the language
          changes, so it is physical. */}
      <FavoriteButton campsiteId={campsite.id} style={styles.heartPosition} />
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  // Always right-aligned (the layout is RTL in every language); the reading
  // direction follows the language. Stating writingDirection also puts a
  // one-line text's ellipsis at the END of the sentence: without it a Hebrew
  // line was laid out left-to-right and cut off its first words instead.
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    card: {
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    pressed: { opacity: 0.85 },
    flex: { flex: 1 },
    // 2:1: a real photo still reads as a photo, while a card is ~100px
    // shorter than at 16:9, so more than one result fits on a phone screen.
    cover: { width: "100%", aspectRatio: 2, borderRadius: 0 },
    heartPosition: { position: "absolute", top: 4, left: 4 },
    kindBadge: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: "rgba(17,24,20,0.62)",
    },
    kindText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#FFFFFF" },
    content: { paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 14, gap: 6 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    name: { fontFamily: fonts.displayBold, fontSize: 16.5, lineHeight: 22, color: colors.text, ...text },
    price: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22, color: colors.accentDeep, writingDirection },
    // Fixed line heights: a character from a fallback font (some hours
    // notes have them) otherwise grew its line, and its card, by a pixel.
    meta: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textMuted, ...text },
    amenities: { flexDirection: "row", gap: 6 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    metaRegion: { flexShrink: 0 },
    note: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20, color: colors.primary, ...text },

    compactCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      paddingEnd: 2,
      marginBottom: spacing.sm + 2,
    },
    tile: { width: 72, height: 72, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    compactMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
    compactBody: { flex: 1, minWidth: 0, gap: 3 },
  });
}
