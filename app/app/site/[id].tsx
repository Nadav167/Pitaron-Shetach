import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Appbar, Button, Divider, List, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCampsite } from "@/hooks/useSite";
import { useLocale } from "@/context/LocaleContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import UnofficialNotice from "@/components/UnofficialNotice";
import CampsiteCover from "@/components/CampsiteCover";
import NavigationButtons from "@/components/NavigationButtons";
import { coordsSourceName, localized, type Amenities } from "@/types/campsite";

// The layout is always right-to-left, in every language (see LocaleContext),
// so everything below is written for RTL outright rather than switched on
// the locale.
//
// react-native-paper's List.Item (MD3) hardcodes *physical* padding/margin
// for its icon slot — a fixed paddingRight on the row, a fixed paddingLeft
// on the content, a fixed marginRight on the icon itself. None of those
// mirror under RTL the way flexDirection: row does: the icon does move to
// the correct (right) side, but the icon-to-text gap and the row's own edge
// padding stay glued to their LTR position. These re-mirror them by hand.
const LIST_ITEM_STYLE = { paddingRight: 0, paddingLeft: 24 };
const LIST_CONTENT_STYLE = { paddingLeft: 0, paddingRight: 16 };

function mirroredIcon(icon: string) {
  // Loosely typed on purpose: the style prop List.Item hands to its
  // left render prop comes from react-native-paper's own (unexported)
  // Style type, and the monorepo has two copies of the react-native
  // package on disk (root + this workspace) whose ViewStyle types don't
  // structurally match -- importing StyleProp<ViewStyle> here to type it
  // precisely trips that duplicate-package mismatch instead of catching a
  // real bug.
  return (props: { color: string; style?: object }) => (
    <List.Icon {...props} icon={icon} style={[props.style, { marginRight: 0, marginLeft: 16 }]} />
  );
}

export default function CampsiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campsite, loading, error } = useCampsite(id);
  const { locale, t, writingDirection } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);
  // react-native-paper's own <Text> hardcodes `textAlign: 'left'` and, on
  // web, `writingDirection: 'ltr'` — it never follows RTL by itself, so
  // every List.Item title/description gets this through titleStyle /
  // descriptionStyle. Alignment is always right; only the reading direction
  // follows the language.
  const rtlText = useMemo(() => ({ textAlign: "right" as const, writingDirection }), [writingDirection]);

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


  const priceLabel = !campsite
    ? ""
    : campsite.pricing.isFree
    ? t("common.free")
    : campsite.pricing.perNight != null
    ? `₪${campsite.pricing.perNight} ${t("common.perNight")}`
    : t("common.priceUnknown");

  // Price or hours came back empty from the source. Say so in plain words
  // (and point at the phone number, when there is one) rather than leaving
  // a bare "unknown" for the visitor to puzzle over.
  const hasMissingInfo = campsite
    ? (!campsite.pricing.isFree && campsite.pricing.perNight == null) || !campsite.openingHours.note
    : false;
  const missingInfoMessage = campsite?.contact.phone
    ? `${t("site.missingInfo")} ${t("site.missingInfoCall")}`
    : t("site.missingInfo");
  const coordsSource = campsite ? coordsSourceName(campsite) : null;
  const coverCredit = campsite?.photos.find((photo) => !photo.isPlaceholder)?.credit ?? null;
  const favoriteLabel = favorite ? t("site.removeFromFavorites") : t("site.addToFavorites");

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar} elevated>
        {/* A plain arrow rather than Appbar.BackAction: Paper's back icon
            only mirrors when I18nManager says RTL, which never happens on
            web, so it kept pointing left in a right-to-left layout. It
            points right in every language, because the layout never flips. */}
        <Appbar.Action
          icon="arrow-right"
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={name} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !campsite ? (
        <EmptyState message={error ?? t("common.error")} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* The site's photo, or the generic camping cover in the same box
              when the source has none (or only an "illustration" stock photo). */}
          <CampsiteCover campsite={campsite} style={styles.cover} />

          {!campsite.isOfficial && <UnofficialNotice variant="full" />}

          {campsite.isOfficial && (
            <View style={styles.officialBadge}>
              <MaterialCommunityIcons name="shield-check" size={15} color={colors.primary} />
              <Text variant="labelMedium" style={styles.officialBadgeText}>
                {t("site.officialLong")}
              </Text>
            </View>
          )}

          {description ? (
            <Text variant="bodyMedium" style={styles.description}>
              {description}
            </Text>
          ) : null}

          {/* The one favorite control on this screen: a labeled button in
              the page itself, rather than a bare heart in the corner of the
              app bar. */}
          <Button
            mode={favorite ? "contained" : "outlined"}
            icon={favorite ? "heart" : "heart-outline"}
            buttonColor={favorite ? colors.danger : undefined}
            textColor={favorite ? colors.background : colors.danger}
            style={[styles.favoriteButton, !favorite && { borderColor: colors.danger }]}
            onPress={() => toggleFavorite(campsite.id)}
          >
            {favoriteLabel}
          </Button>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t("site.navigate")}
          </Text>
          <NavigationButtons campsite={campsite} size="full" />
          {!campsite.coordinates && (
            <Text variant="labelSmall" style={styles.noCoords}>
              {t("site.noCoordinatesLong")}
            </Text>
          )}

          <Divider style={styles.divider} />

          <List.Section>
            <List.Item
              title={t("site.price")}
              description={
                campsite.pricing.note ? `${priceLabel} — ${campsite.pricing.note}` : priceLabel
              }
              descriptionNumberOfLines={3}
              left={mirroredIcon("cash-multiple")}
              style={LIST_ITEM_STYLE}
              contentStyle={LIST_CONTENT_STYLE}
              titleStyle={rtlText}
              descriptionStyle={rtlText}
            />
            <List.Item
              title={t("site.region")}
              description={t(`region.${campsite.region}`)}
              left={mirroredIcon("map-marker-outline")}
              style={LIST_ITEM_STYLE}
              contentStyle={LIST_CONTENT_STYLE}
              titleStyle={rtlText}
              descriptionStyle={rtlText}
            />
            <List.Item
              title={t("site.openingHours")}
              description={campsite.openingHours.note ?? t("common.unknown")}
              descriptionNumberOfLines={4}
              left={mirroredIcon("clock-outline")}
              style={LIST_ITEM_STYLE}
              contentStyle={LIST_CONTENT_STYLE}
              titleStyle={rtlText}
              descriptionStyle={rtlText}
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
                left={mirroredIcon("login-variant")}
                style={LIST_ITEM_STYLE}
                contentStyle={LIST_CONTENT_STYLE}
                titleStyle={rtlText}
                descriptionStyle={rtlText}
              />
            )}
          </List.Section>

          {hasMissingInfo && (
            <View style={styles.missingInfo}>
              <Text variant="bodySmall" style={styles.missingInfoText}>
                {missingInfoMessage}
              </Text>
            </View>
          )}

          {knownAmenities.length > 0 && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t("site.amenities")}
              </Text>
              <View style={styles.chipRow}>
                {knownAmenities.map(([key]) => (
                  <View key={key} style={styles.chip}>
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.textMuted} />
                    <Text variant="labelMedium" style={styles.chipText}>
                      {t(`site.amenity.${key}`)}
                    </Text>
                  </View>
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
                    left={mirroredIcon("phone-outline")}
                    style={LIST_ITEM_STYLE}
                    contentStyle={LIST_CONTENT_STYLE}
                    titleStyle={rtlText}
                    onPress={() => Linking.openURL(`tel:${campsite.contact.phone}`)}
                  />
                )}
                {campsite.contact.website && (
                  <List.Item
                    title={t("site.sourcePage")}
                    description={campsite.source.name}
                    left={mirroredIcon("web")}
                    style={LIST_ITEM_STYLE}
                    contentStyle={LIST_CONTENT_STYLE}
                    titleStyle={rtlText}
                    descriptionStyle={rtlText}
                    onPress={() => Linking.openURL(campsite.contact.website!)}
                  />
                )}
                {campsite.contact.email && (
                  <List.Item
                    title={campsite.contact.email}
                    left={mirroredIcon("email-outline")}
                    style={LIST_ITEM_STYLE}
                    contentStyle={LIST_CONTENT_STYLE}
                    titleStyle={rtlText}
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
          <Text variant="labelSmall" style={styles.provenance}>
            {`${t("site.dataFrom")}: ${campsite.source.name}`}
          </Text>
          {coordsSource && (
            <Text variant="labelSmall" style={styles.provenance}>
              {`${t("site.coordsFrom")}: ${coordsSource}`}
            </Text>
          )}
          {/* Commons photos are CC-licensed and must credit author + licence. */}
          {coverCredit && (
            <Text variant="labelSmall" style={styles.provenance}>
              {`${t("site.photoFrom")}: ${coverCredit}`}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const align = "right" as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    appbar: { backgroundColor: colors.background },
    appbarTitle: { fontFamily: fonts.displayBold, color: colors.text, textAlign: align },
    content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
    // Caps and centers the detail content on wide windows instead of
    // letting it stretch edge to edge — same treatment as Home's desktop
    // layout, just narrower since this is single-column reading content
    // rather than a card grid.
    contentDesktop: { width: "100%", maxWidth: 800, marginHorizontal: "auto" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    cover: { width: "100%", height: 200, aspectRatio: undefined, borderRadius: radius.md, overflow: "hidden" },
    officialBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: colors.primaryTint,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    officialBadgeText: { color: colors.primary, textAlign: align },
    description: { color: colors.textMuted, marginTop: spacing.xs, textAlign: align, writingDirection },
    favoriteButton: { marginTop: spacing.sm, borderRadius: radius.md },
    sectionTitle: { marginTop: spacing.md, fontFamily: fonts.displayBold, color: colors.text, textAlign: align },
    missingInfo: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    missingInfoText: { color: colors.textMuted, textAlign: align, writingDirection },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      marginBottom: spacing.xs,
    },
    chipText: { color: colors.textMuted, textAlign: align },
    muted: { color: colors.textMuted, textAlign: align, writingDirection },
    // Paper's <Text> also pins `writingDirection` to "ltr" on web, so a
    // Hebrew line that contains a Latin domain ("מקור נקודת הציון:
    // amudanan.co.il") was laid out left-to-right and came out scrambled.
    // The direction has to be stated outright; textAlign alone isn't enough.
    provenance: { color: colors.textMuted, textAlign: align, writingDirection },
    noCoords: { color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, textAlign: align, writingDirection },
    divider: { marginTop: spacing.lg, marginBottom: spacing.sm },
  });
}
