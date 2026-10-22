import React, { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, Button, Snackbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCampsite } from "@/hooks/useSite";
import { useLocale } from "@/context/LocaleContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import UnofficialNotice from "@/components/UnofficialNotice";
import CampsiteCover from "@/components/CampsiteCover";
import NavigationButtons from "@/components/NavigationButtons";
import ExpandableText from "@/components/ExpandableText";
import { cardFacts } from "@/lib/campsiteText";
import { shareCampsite } from "@/lib/share";
import { PIN_GLYPH } from "@/constants/map";
import { coordsSourceName, isNightCamp, localized, type Amenities } from "@/types/campsite";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Height of the Waze / Google Maps bar pinned to the bottom on phones. */
const ACTION_BAR_HEIGHT = 50 + spacing.sm * 2;

// The layout is always right-to-left, in every language (see LocaleContext),
// so everything below is written for RTL outright rather than switched on
// the locale. Text is plain React Native <Text>, not Paper's: Paper's pins
// `textAlign: 'left'` and, on web, `writingDirection: 'ltr'`, and its
// List.Item hard-codes physical paddings that left a wide gap between each
// icon and its text in this layout.

/**
 * A campsite's page. On phones: the photo runs edge to edge under round
 * back / share buttons, the details sit on a sheet that overlaps it, and
 * the navigation buttons stay pinned to the bottom of the screen, so
 * "take me there" is one tap from anywhere on the page. On desktop-width
 * screens the same content is a centered 800px column with the navigation
 * buttons inline.
 */
export default function CampsiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campsite, loading } = useCampsite(id);
  const { locale, t, writingDirection } = useLocale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  // Opened straight from a shared link there is no screen to go back to.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const backButton = (
    <Pressable
      onPress={goBack}
      style={[styles.roundButton, styles.backButton, { top: insets.top + spacing.sm }]}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
    >
      {/* Points right in every language: the layout never flips. */}
      <MaterialCommunityIcons name="arrow-right" size={22} color={colors.text} />
    </Pressable>
  );

  if (loading || !campsite) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + TOUCH_TARGET + spacing.lg }]}>
        {backButton}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          // Every site ships inside the app (useCampsite only refreshes it
          // from the API), so no record means a wrong or outdated link, not
          // a network problem. The raw fetch error ("Failed to fetch") used to
          // be shown here instead.
          <EmptyState
            icon="map-marker-question-outline"
            message={t("site.notFound")}
            action={{ label: t("site.backHome"), onPress: () => router.replace("/") }}
          />
        )}
      </View>
    );
  }

  const name = localized(campsite.name, locale);
  const description = campsite.description ? localized(campsite.description, locale) : "";
  const favorite = isFavorite(campsite.id);
  const nightCamp = isNightCamp(campsite);
  const { price } = cardFacts(campsite, t);
  const { checkIn, checkOut, note: hoursNote } = campsite.openingHours;
  const phone = campsite.contact.phone;

  // An amenity key that's absent means "unknown", not "absent" — only keys the
  // scraper positively confirmed are shown.
  const knownAmenities = (Object.entries(campsite.amenities) as [keyof Amenities, boolean | undefined][]).filter(
    ([, enabled]) => enabled === true
  );

  // Price or hours came back empty from the source. Say so in plain words
  // (and point at the phone number, when there is one) rather than leaving
  // a bare "unknown" for the visitor to puzzle over.
  const hasMissingInfo = (!campsite.pricing.isFree && campsite.pricing.perNight == null) || !hoursNote;
  const missingInfoMessage = phone ? `${t("site.missingInfo")} ${t("site.missingInfoCall")}` : t("site.missingInfo");
  const coordsSource = coordsSourceName(campsite);
  const coverCredit = campsite.photos.find((photo) => !photo.isPlaceholder)?.credit ?? null;
  const favoriteLabel = favorite ? t("site.removeFromFavorites") : t("site.addToFavorites");

  const share = async () => {
    const result = await shareCampsite(campsite, name);
    if (result === "copied") setMessage(t("site.linkCopied"));
    else if (result === "failed") setMessage(t("site.shareFailed"));
  };

  // Three quick facts under the title. The second and third fall back to
  // other facts when the source didn't give an arrival time or a phone.
  const facts: { key: string; label: string; value: string; icon: IconName; onPress?: () => void }[] = [
    {
      key: "price",
      label: t("site.price"),
      // The tile is already labelled "price": "unknown" alone fits in it.
      value: campsite.pricing.isFree || campsite.pricing.perNight != null ? price : t("common.unknown"),
      icon: "cash",
    },
    checkIn
      ? { key: "checkIn", label: t("site.checkIn"), value: checkIn, icon: "clock-outline" }
      : { key: "region", label: t("site.region"), value: t(`region.${campsite.region}`), icon: "map-marker-outline" },
    phone
      ? {
          key: "phone",
          label: t("site.phone"),
          value: t("site.call"),
          icon: "phone-outline",
          onPress: () => Linking.openURL(`tel:${phone}`),
        }
      : {
          key: "kind",
          label: t("site.kindLabel"),
          value: t(nightCamp ? "site.kind.nightCamp" : "site.kind.campground"),
          icon: nightCamp ? PIN_GLYPH.official : PIN_GLYPH.unofficial,
        },
  ];

  const contactRows: { key: string; icon: IconName; title: string; subtitle?: string; onPress: () => void }[] = [];
  if (phone) contactRows.push({ key: "phone", icon: "phone-outline", title: phone, onPress: () => Linking.openURL(`tel:${phone}`) });
  if (campsite.contact.website) {
    const website = campsite.contact.website;
    contactRows.push({
      key: "web",
      icon: "web",
      title: t("site.sourcePage"),
      subtitle: campsite.source.name,
      onPress: () => Linking.openURL(website),
    });
  }
  if (campsite.contact.email) {
    const email = campsite.contact.email;
    contactRows.push({ key: "email", icon: "email-outline", title: email, onPress: () => Linking.openURL(`mailto:${email}`) });
  }

  const hoursLines = [
    checkIn && `${t("site.checkIn")}: ${checkIn}`,
    checkOut && `${t("site.checkOut")}: ${checkOut}`,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          isDesktop && styles.contentDesktop,
          { paddingBottom: isDesktop ? spacing.xl : ACTION_BAR_HEIGHT + insets.bottom + spacing.lg },
        ]}
      >
        <View style={isDesktop ? styles.coverWrapDesktop : undefined}>
          {/* The site's photo, or the generic camping cover in the same box
              when the source has none (or only an "illustration" stock photo). */}
          <CampsiteCover campsite={campsite} style={[styles.cover, isDesktop && styles.coverDesktop]} />
          <Pressable
            onPress={share}
            style={[
              styles.roundButton,
              // On desktop the cover is inset by the column's padding.
              { left: isDesktop ? spacing.md * 2 : spacing.md, top: (isDesktop ? 0 : insets.top) + spacing.sm },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("site.share")}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.sheet, isDesktop && styles.sheetDesktop]}>
          <Text style={styles.title} accessibilityRole="header">
            {name}
          </Text>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.primaryTint }]}>
              <MaterialCommunityIcons name={nightCamp ? PIN_GLYPH.official : PIN_GLYPH.unofficial} size={14} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {t(nightCamp ? "site.kind.nightCamp" : "site.kind.campground")}
              </Text>
            </View>
            <View style={[styles.badge, styles.badgeOutline]}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text style={styles.badgeText}>{t(`region.${campsite.region}`)}</Text>
            </View>
            {campsite.isOfficial && (
              <View style={[styles.badge, { backgroundColor: colors.primaryTint }]}>
                <MaterialCommunityIcons name="shield-check" size={14} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>{t("site.officialLong")}</Text>
              </View>
            )}
          </View>

          {!campsite.isOfficial && <UnofficialNotice variant="full" />}

          <View style={styles.facts}>
            {facts.map((fact) => {
              const body = (
                <>
                  <MaterialCommunityIcons name={fact.icon} size={18} color={colors.primaryLight} style={styles.factIcon} />
                  <Text style={styles.factLabel}>{fact.label}</Text>
                  <Text style={[styles.factValue, fact.onPress && styles.factLink]} numberOfLines={1}>
                    {fact.value}
                  </Text>
                </>
              );
              return fact.onPress ? (
                <Pressable key={fact.key} style={styles.fact} onPress={fact.onPress} accessibilityRole="link">
                  {body}
                </Pressable>
              ) : (
                <View key={fact.key} style={styles.fact}>
                  {body}
                </View>
              );
            })}
          </View>

          {description ? <Text style={styles.body}>{description}</Text> : null}

          {/* The one favorite control on this screen: a labeled button in
              the page itself, rather than a bare heart in a corner. */}
          <Button
            mode={favorite ? "contained" : "outlined"}
            icon={favorite ? "heart" : "heart-outline"}
            buttonColor={favorite ? colors.danger : undefined}
            textColor={favorite ? colors.background : colors.danger}
            style={[styles.favoriteButton, !favorite && { borderColor: colors.danger }]}
            contentStyle={styles.favoriteContent}
            onPress={() => toggleFavorite(campsite.id)}
          >
            {favoriteLabel}
          </Button>

          {isDesktop && (
            <>
              <Text style={styles.sectionTitle}>{t("site.navigate")}</Text>
              <NavigationButtons campsite={campsite} />
            </>
          )}
          {!campsite.coordinates && <Text style={styles.noCoords}>{t("site.noCoordinatesLong")}</Text>}

          {(hoursNote || hoursLines.length > 0) && (
            <>
              <Text style={styles.sectionTitle}>{t("site.openingHours")}</Text>
              {hoursLines.length > 0 && <Text style={styles.body}>{hoursLines.join(" · ")}</Text>}
              {hoursNote ? (
                <ExpandableText text={hoursNote} style={styles.body} toggleStyle={styles.toggle} />
              ) : null}
            </>
          )}

          {campsite.pricing.note ? (
            <>
              <Text style={styles.sectionTitle}>{t("site.priceNote")}</Text>
              <ExpandableText text={campsite.pricing.note} style={styles.body} toggleStyle={styles.toggle} />
            </>
          ) : null}

          {hasMissingInfo && (
            <View style={styles.missingInfo}>
              <Text style={styles.missingInfoText}>{missingInfoMessage}</Text>
            </View>
          )}

          {knownAmenities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("site.amenities")}</Text>
              <View style={styles.chipRow}>
                {knownAmenities.map(([key]) => (
                  <View key={key} style={styles.chip}>
                    <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.primaryLight} />
                    <Text style={styles.chipText}>{t(`site.amenity.${key}`)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {contactRows.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("site.contact")}</Text>
              <View style={styles.rows}>
                {contactRows.map((row, index) => (
                  <Pressable
                    key={row.key}
                    onPress={row.onPress}
                    style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
                    accessibilityRole="link"
                  >
                    <MaterialCommunityIcons name={row.icon} size={20} color={colors.primary} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      {row.subtitle ? <Text style={styles.rowSubtitle}>{row.subtitle}</Text> : null}
                    </View>
                    <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Provenance. Scraped data goes stale and occasionally lands a pin in
              the wrong place; showing where a record came from lets someone
              check the source rather than trust us blindly. */}
          <View style={styles.provenanceBlock}>
            <Text style={styles.provenance}>{`${t("site.dataFrom")}: ${campsite.source.name}`}</Text>
            {coordsSource && <Text style={styles.provenance}>{`${t("site.coordsFrom")}: ${coordsSource}`}</Text>}
            {/* Commons photos are CC-licensed and must credit author + licence. */}
            {coverCredit && <Text style={styles.provenance}>{`${t("site.photoFrom")}: ${coverCredit}`}</Text>}
          </View>
        </View>
      </ScrollView>

      {backButton}

      {!isDesktop && (
        <View style={[styles.actionBar, { paddingBottom: spacing.sm + insets.bottom }]}>
          <NavigationButtons campsite={campsite} />
        </View>
      )}

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={3000}
        wrapperStyle={{ bottom: isDesktop ? 0 : ACTION_BAR_HEIGHT + insets.bottom }}
      >
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // Caps and centers the detail content on wide windows instead of
    // letting it stretch edge to edge — same treatment as Home's desktop
    // layout, just narrower since this is single-column reading content
    // rather than a card grid.
    contentDesktop: { width: "100%", maxWidth: 800, marginHorizontal: "auto", paddingTop: spacing.lg },
    cover: { width: "100%", height: 280, aspectRatio: undefined },
    coverDesktop: { height: 340, borderRadius: radius.lg, overflow: "hidden" },
    coverWrapDesktop: { paddingHorizontal: spacing.md },
    roundButton: {
      position: "absolute",
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.backgroundElevated,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    // Physical sides, like the rest of the fixed right-to-left layout: back
    // on the right (where reading starts), share on the left.
    backButton: { right: spacing.md },
    sheet: {
      marginTop: -22,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      gap: spacing.sm + 4,
    },
    sheetDesktop: { marginTop: 0 },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text, ...text },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 30,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
    },
    badgeOutline: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    badgeText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, writingDirection },
    facts: { flexDirection: "row", gap: spacing.sm },
    fact: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    // flex-start is the right-hand side in the right-to-left layout.
    factIcon: { alignSelf: "flex-start" },
    factLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 4, ...text },
    factValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, ...text },
    factLink: { color: colors.primary, textDecorationLine: "underline" },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.text, ...text },
    toggle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary, textDecorationLine: "underline", ...text },
    favoriteButton: { borderRadius: radius.md },
    favoriteContent: { height: 48 },
    sectionTitle: {
      marginTop: spacing.sm,
      fontFamily: fonts.displayBold,
      fontSize: 17,
      color: colors.text,
      ...text,
    },
    missingInfo: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    missingInfoText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textMuted, ...text },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 34,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
    },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.text, writingDirection },
    rows: {
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: spacing.md },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pressed: { backgroundColor: colors.surfaceAlt },
    rowText: { flex: 1, minWidth: 0, paddingVertical: spacing.sm },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, ...text },
    rowSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, ...text },
    // Paper's <Text> also pins `writingDirection` to "ltr" on web, so a
    // Hebrew line that contains a Latin domain ("מקור נקודת הציון:
    // amudanan.co.il") was laid out left-to-right and came out scrambled.
    // The direction has to be stated outright; textAlign alone isn't enough.
    provenanceBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 4,
    },
    provenance: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, ...text },
    noCoords: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, fontStyle: "italic", ...text },
    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      backgroundColor: colors.backgroundElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}
