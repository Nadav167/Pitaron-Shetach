import React, { useMemo } from "react";
import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";
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
import NavigationButtons from "@/components/NavigationButtons";
import { localized, type Amenities } from "@/types/campsite";

// react-native-paper's List.Item (MD3) hardcodes *physical* padding/margin
// for its icon slot — a fixed paddingRight on the row, a fixed paddingLeft
// on the content, a fixed marginRight on the icon itself. None of those
// mirror under RTL the way flexDirection: row does (same category of bug as
// the absolute-positioned favorite heart, fixed earlier): the icon does
// move to the correct (right) side under Hebrew, but the icon-to-text gap
// and the row's own edge padding stay glued to their LTR position. These
// two small helpers re-mirror them manually.
function listItemStyle(isRTL: boolean) {
  return isRTL ? { paddingRight: 0, paddingLeft: 24 } : undefined;
}
function listContentStyle(isRTL: boolean) {
  return isRTL ? { paddingLeft: 0, paddingRight: 16 } : undefined;
}
function mirroredIcon(icon: string, isRTL: boolean) {
  // Loosely typed on purpose: the style prop List.Item hands to its
  // left render prop comes from react-native-paper's own (unexported)
  // Style type, and the monorepo has two copies of the react-native
  // package on disk (root + this workspace) whose ViewStyle types don't
  // structurally match -- importing StyleProp<ViewStyle> here to type it
  // precisely trips that duplicate-package mismatch instead of catching a
  // real bug.
  return (props: { color: string; style?: object }) => (
    <List.Icon
      {...props}
      icon={icon}
      style={isRTL ? [props.style, { marginRight: 0, marginLeft: 16 }] : props.style}
    />
  );
}

// react-native-paper's own <Text> component hardcodes `textAlign: 'left'`
// unconditionally (see node_modules/react-native-paper/src/components/
// Typography/Text.tsx) — it never mirrors under RTL on its own. This is
// the actual root cause behind the detail screen still reading as LTR even
// after the I18nManager and List.Item padding fixes: those fixed *layout*
// (row order, icon gap), but every Paper Text and List.Item title/
// description still rendered flush left regardless of language. List.Item
// exposes titleStyle/descriptionStyle for exactly this override.
function textAlignStyle(isRTL: boolean) {
  return { textAlign: isRTL ? ("right" as const) : ("left" as const) };
}

export default function CampsiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campsite, loading, error } = useCampsite(id);
  const { locale, t, isRTL } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);
  const rtlText = useMemo(() => textAlignStyle(isRTL), [isRTL]);

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
        <Appbar.Content title={name} titleStyle={styles.appbarTitle} />
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
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
          {cover && <Image source={{ uri: cover.url }} style={styles.cover} resizeMode="cover" />}
          {placeholderOnly && (
            <Text variant="labelSmall" style={styles.muted}>
              {t("site.photoPlaceholderOnly")}
            </Text>
          )}

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
              left={mirroredIcon("cash-multiple", isRTL)}
              style={listItemStyle(isRTL)}
              contentStyle={listContentStyle(isRTL)}
              titleStyle={rtlText}
              descriptionStyle={rtlText}
            />
            <List.Item
              title={t("site.region")}
              description={t(`region.${campsite.region}`)}
              left={mirroredIcon("map-marker-outline", isRTL)}
              style={listItemStyle(isRTL)}
              contentStyle={listContentStyle(isRTL)}
              titleStyle={rtlText}
              descriptionStyle={rtlText}
            />
            <List.Item
              title={t("site.openingHours")}
              description={campsite.openingHours.note ?? t("common.unknown")}
              descriptionNumberOfLines={4}
              left={mirroredIcon("clock-outline", isRTL)}
              style={listItemStyle(isRTL)}
              contentStyle={listContentStyle(isRTL)}
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
                left={mirroredIcon("login-variant", isRTL)}
                style={listItemStyle(isRTL)}
                contentStyle={listContentStyle(isRTL)}
                titleStyle={rtlText}
                descriptionStyle={rtlText}
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
                    left={mirroredIcon("phone-outline", isRTL)}
                    style={listItemStyle(isRTL)}
                    contentStyle={listContentStyle(isRTL)}
                    titleStyle={rtlText}
                    onPress={() => Linking.openURL(`tel:${campsite.contact.phone}`)}
                  />
                )}
                {campsite.contact.website && (
                  <List.Item
                    title={t("site.sourcePage")}
                    description={campsite.source.name}
                    left={mirroredIcon("web", isRTL)}
                    style={listItemStyle(isRTL)}
                    contentStyle={listContentStyle(isRTL)}
                    titleStyle={rtlText}
                    descriptionStyle={rtlText}
                    onPress={() => Linking.openURL(campsite.contact.website!)}
                  />
                )}
                {campsite.contact.email && (
                  <List.Item
                    title={campsite.contact.email}
                    left={mirroredIcon("email-outline", isRTL)}
                    style={listItemStyle(isRTL)}
                    contentStyle={listContentStyle(isRTL)}
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

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  const align = isRTL ? ("right" as const) : ("left" as const);
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
    cover: { width: "100%", height: 200, borderRadius: radius.md },
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
    description: { color: colors.textMuted, marginTop: spacing.xs, textAlign: align },
    sectionTitle: { marginTop: spacing.md, fontFamily: fonts.displayBold, color: colors.text, textAlign: align },
    favoriteButton: { marginVertical: spacing.md },
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
    muted: { color: colors.textMuted, textAlign: align },
    noCoords: { color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs, textAlign: align },
    divider: { marginTop: spacing.lg, marginBottom: spacing.sm },
  });
}
