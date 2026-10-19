import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import EmptyState from "@/components/EmptyState";
import { fetchItineraries } from "@/services/itineraries";
import { daysLabel, formatDate, planLabels } from "@/lib/itinerary";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { Itinerary } from "@/types/itinerary";

/**
 * The signed-in user's saved itineraries, newest first. The tab only shows
 * in the bar while someone is signed in (see (tabs)/_layout). The list is
 * reloaded every time the tab comes into view, so a trip the agent just
 * saved is there without a manual refresh.
 */
export default function ItinerariesScreen() {
  const { status } = useAuth();
  const { t, locale, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const [itineraries, setItineraries] = useState<Itinerary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (status !== "signedIn") return;
      let active = true;
      fetchItineraries()
        .then((list) => {
          if (!active) return;
          setItineraries(list);
          setFailed(false);
        })
        .catch(() => active && setFailed(true));
      return () => {
        active = false;
      };
    }, [status])
  );

  const title = <Text style={styles.title}>{t("itineraries.title")}</Text>;

  if (status !== "signedIn") {
    return (
      <View style={styles.container}>
        <View style={styles.padded}>{title}</View>
        <EmptyState message={t("itineraries.loginRequired")} />
      </View>
    );
  }

  if (itineraries === null) {
    return (
      <View style={styles.container}>
        <View style={styles.padded}>{title}</View>
        {failed ? (
          <EmptyState message={t("common.error")} />
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        )}
      </View>
    );
  }

  if (itineraries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.padded}>{title}</View>
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-search-outline" size={44} color={colors.textFaint} />
          <Text style={styles.emptyText}>{t("itineraries.empty")}</Text>
          <Pressable style={styles.cta} onPress={() => router.push("/agent")} accessibilityRole="button">
            <Text style={styles.ctaText}>{t("itineraries.emptyCta")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const columns = isDesktop ? 2 : 1;
  return (
    <View style={styles.container}>
      <FlatList
        key={columns}
        data={itineraries}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
        ListHeaderComponent={<View style={styles.header}>{title}</View>}
        renderItem={({ item }) => {
          const { t: planT, direction } = planLabels(item);
          const planText = { writingDirection: direction, textAlign: direction === "rtl" ? ("right" as const) : ("left" as const) };
          return (
            <Pressable
              style={({ pressed }) => [styles.card, columns > 1 && styles.cardHalf, pressed && styles.pressed]}
              onPress={() => router.push(`/itinerary/${item.id}`)}
              accessibilityRole="link"
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons name="map-marker-path" size={20} color={colors.onPrimary} />
                </View>
                <Text style={[styles.cardTitle, planText]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <Text style={[styles.cardSummary, planText]} numberOfLines={3}>
                {item.plan.summary}
              </Text>
              <View style={styles.cardMeta}>
                <View style={styles.metaChip}>
                  <MaterialCommunityIcons name="calendar-range" size={14} color={colors.primary} />
                  <Text style={styles.metaText}>{daysLabel(item, planT)}</Text>
                </View>
                <Text style={styles.created}>
                  {t("itineraries.createdOn").replace("{date}", formatDate(item.createdAt, locale))}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    padded: { padding: spacing.md },
    header: { paddingBottom: spacing.md },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.text, textAlign: "right", writingDirection },
    pressed: { opacity: 0.8 },

    // Room at the bottom for the floating tab bar on phones.
    list: { padding: spacing.md, paddingBottom: 110, gap: spacing.md },
    listDesktop: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingBottom: spacing.xl },
    row: { gap: spacing.md },

    card: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardHalf: { flex: 1 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 17, color: colors.text },
    cardSummary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textMuted },
    cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTint,
    },
    metaText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary },
    created: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, writingDirection },

    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg, paddingBottom: 110 },
    emptyText: {
      maxWidth: 360,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 23,
      color: colors.textMuted,
      textAlign: "center",
      writingDirection,
    },
    cta: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10 },
    ctaText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
  });
}
