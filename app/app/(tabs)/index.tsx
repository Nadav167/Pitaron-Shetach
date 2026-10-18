import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useCampsites } from "@/hooks/useSites";
import { useDistanceNote, useSiteFilters } from "@/hooks/useSiteFilters";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import SiteList from "@/components/SiteList";
import SiteFilterBar from "@/components/SiteFilterBar";
import { spacing, fonts, type ColorTokens } from "@/constants/theme";
import type { Campsite } from "@/types/campsite";

export default function HomeScreen() {
  const { campsites, loading } = useCampsites();
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const filters = useSiteFilters(campsites);
  const distanceNote = useDistanceNote(filters);

  const openCampsite = (campsite: Campsite) => router.push(`/site/${campsite.id}`);

  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const header = isDesktop ? (
    <View style={styles.desktopHero}>
      <Text style={styles.desktopTitle}>{t("common.appName")}</Text>
      <Text variant="bodyMedium" style={styles.desktopSubtitle}>
        {t("common.slogan")}
      </Text>
      <SiteFilterBar filters={filters} centered />
    </View>
  ) : (
    <View style={styles.mobileHeader}>
      <Text style={styles.mobileSlogan}>{t("common.slogan")}</Text>
      <SiteFilterBar filters={filters} />
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.fill}>
          <SiteList
            campsites={filters.visible}
            onSelectCampsite={openCampsite}
            numColumns={isDesktop ? 3 : 1}
            header={header}
            noteFor={distanceNote}
            contentMaxWidth={isDesktop ? 1200 : undefined}
          />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  // Always right-aligned: the layout is the Hebrew one in every language
  // (see LocaleContext). Only the reading direction follows the language.
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    fill: { flex: 1 },
    // The 1200px-max centering itself now lives on SiteList's own
    // `contentMaxWidth` prop (applied to the FlatList's content, not this
    // wrapper) — see SiteList.tsx for why: capping this outer View instead
    // used to also cap the *scrollable* element, leaving the native
    // scrollbar stuck at the edge of a centered box instead of the true
    // edge of the browser window.

    // Mobile header: the brand name itself is in MobileHeader, directly
    // above; this is the slogan under it, then search + chips.
    mobileHeader: { paddingHorizontal: spacing.md, paddingTop: 0 },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless
    // of RTL -- override explicitly (same fix as the detail screen).
    mobileSlogan: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: spacing.md,
      ...text,
    },

    // Desktop hero: centered name/slogan/search/chips above a 3-column grid.
    desktopHero: { alignItems: "center", padding: spacing.xl, paddingBottom: spacing.md },
    desktopTitle: {
      fontFamily: fonts.display,
      fontSize: 34,
      color: colors.text,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    desktopSubtitle: { color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
  });
}
