import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Appbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import EmptyState from "@/components/EmptyState";
import { deleteItinerary, fetchItinerary } from "@/services/itineraries";
import { daysLabel, formatDate, KIND_ICONS, planLabels } from "@/lib/itinerary";
// Web-only at runtime (they touch window/document inside the functions);
// the buttons that call them only render on web.
import { printItinerary } from "@/lib/itineraryPrint";
import { downloadItineraryPdf } from "@/lib/itineraryPdf";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { Itinerary } from "@/types/itinerary";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * One saved itinerary: the plan day by day, with "Save as PDF" (print
 * dialog, selectable text) and "Download PDF" (one-click file) on web, and
 * delete.
 *
 * The plan's own text and labels follow the plan's language (planLabels);
 * the page chrome (app bar, buttons) follows the interface language. Like
 * the rest of the app, the layout is always right-to-left.
 *
 * PDF on the native apps would need expo-print + expo-sharing (not
 * installed), so the PDF buttons are web-only for now.
 */
export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();
  const { t } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const [itinerary, setItinerary] = useState<Itinerary | null | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "working" | "failed">("idle");

  useEffect(() => {
    if (status !== "signedIn" || !id) return;
    let active = true;
    fetchItinerary(id)
      .then((found) => active && setItinerary(found))
      .catch(() => active && setItinerary(null));
    return () => {
      active = false;
    };
  }, [status, id]);

  // A delete armed but not confirmed disarms itself after a few seconds.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/itineraries"));

  const onDelete = async () => {
    if (!itinerary) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await deleteItinerary(itinerary.id);
      router.replace("/itineraries");
    } catch {
      setConfirmingDelete(false);
    }
  };

  // Synchronous on purpose: opening the print tab must happen inside the
  // click, or popup blockers stop it.
  const onSavePdf = () => {
    if (itinerary) printItinerary(itinerary);
  };

  const onDownloadPdf = async () => {
    if (!itinerary || pdfState === "working") return;
    setPdfState("working");
    try {
      await downloadItineraryPdf(itinerary);
      setPdfState("idle");
    } catch (error) {
      console.error("PDF failed", error);
      setPdfState("failed");
    }
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  let body: React.ReactNode;
  if (status === "loading" || (status === "signedIn" && itinerary === undefined)) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (status !== "signedIn") {
    body = <EmptyState message={t("itineraries.loginRequired")} />;
  } else if (!itinerary) {
    body = <EmptyState message={t("itineraries.notFound")} />;
  } else {
    body = (
      <ItineraryBody
        itinerary={itinerary}
        styles={styles}
        colors={colors}
        isDesktop={isDesktop}
        onOpenCampsite={(campsiteId) => router.push(`/site/${campsiteId}`)}
        pdfActions={
          Platform.OS === "web" ? (
            <View style={styles.pdfActions}>
              <Pressable style={({ pressed }) => [styles.pdfButton, pressed && styles.pressed]} onPress={onSavePdf} accessibilityRole="button">
                <MaterialCommunityIcons name="printer-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.pdfButtonText}>{t("itineraries.savePdf")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.pdfButtonAlt, (pressed || pdfState === "working") && styles.pressed]}
                onPress={onDownloadPdf}
                disabled={pdfState === "working"}
                accessibilityRole="button"
              >
                {pdfState === "working" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="file-download-outline" size={18} color={colors.primary} />
                )}
                <Text style={styles.pdfButtonAltText}>
                  {t(pdfState === "working" ? "itineraries.preparingPdf" : "itineraries.downloadPdf")}
                </Text>
              </Pressable>
              {pdfState === "failed" && <Text style={styles.pdfError}>{t("itineraries.pdfFailed")}</Text>}
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar} elevated>
        {/* Same RTL back arrow as the campsite page (see site/[id].tsx). */}
        <Appbar.Action icon="arrow-right" onPress={goBack} accessibilityLabel={t("common.back")} />
        <Appbar.Content title={itinerary?.title ?? t("itineraries.title")} titleStyle={styles.appbarTitle} />
        {itinerary && (
          <Pressable
            onPress={onDelete}
            style={[styles.deleteButton, confirmingDelete && styles.deleteArmed]}
            accessibilityRole="button"
            accessibilityLabel={t(confirmingDelete ? "itineraries.confirmDelete" : "itineraries.delete")}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={confirmingDelete ? colors.onPrimary : colors.danger} />
            {confirmingDelete && <Text style={styles.deleteArmedText}>{t("itineraries.confirmDelete")}</Text>}
          </Pressable>
        )}
      </Appbar.Header>
      {body}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function ItineraryBody({
  itinerary,
  styles,
  colors,
  isDesktop,
  onOpenCampsite,
  pdfActions,
}: {
  itinerary: Itinerary;
  styles: Styles;
  colors: ColorTokens;
  isDesktop: boolean;
  onOpenCampsite: (id: string) => void;
  pdfActions: React.ReactNode;
}) {
  const { plan } = itinerary;
  const { t, language, direction } = planLabels(itinerary);
  // Alignment stays right (the layout is RTL); reading direction follows the plan.
  const text = { writingDirection: direction, textAlign: "right" as const };

  return (
    <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      <View style={styles.hero}>
        <Text style={[styles.title, text]}>{itinerary.title}</Text>
        <Text style={[styles.summary, text]}>{plan.summary}</Text>
        <View style={styles.chips}>
          <Chip icon="calendar-range" label={daysLabel(itinerary, t)} styles={styles} colors={colors} />
          {plan.startDate && (
            <Chip icon="calendar-start" label={formatDate(plan.startDate, language)} styles={styles} colors={colors} />
          )}
          {plan.travelers ? <Chip icon="account-group-outline" label={plan.travelers} styles={styles} colors={colors} /> : null}
        </View>
        {plan.preferences.length > 0 && (
          <Text style={[styles.prefs, text]}>
            {t("preferences")}: {plan.preferences.join(" · ")}
          </Text>
        )}
        {pdfActions}
      </View>

      {plan.days.map((day) => (
        <View key={day.dayNumber} style={styles.day}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayLabel, text]}>
              {t("day").replace("{n}", String(day.dayNumber))}
              {day.date ? ` · ${formatDate(day.date, language)}` : ""}
            </Text>
            <Text style={[styles.dayTitle, text]}>{day.title}</Text>
          </View>

          {day.campsiteName && (
            <Pressable
              disabled={!day.campsiteId}
              onPress={() => day.campsiteId && onOpenCampsite(day.campsiteId)}
              style={({ pressed }) => [styles.camp, pressed && styles.pressed]}
              accessibilityRole={day.campsiteId ? "link" : undefined}
            >
              <MaterialCommunityIcons name="tent" size={18} color={colors.accentDeep} />
              <Text style={[styles.campText, text]}>
                {t("campsite")}: {day.campsiteName}
              </Text>
              {day.campsiteId && <MaterialCommunityIcons name="chevron-left" size={18} color={colors.accentDeep} />}
            </Pressable>
          )}

          {day.items.map((item, index) => (
            <View key={index} style={[styles.item, index === day.items.length - 1 && styles.itemLast]}>
              <Text style={styles.time}>{item.time}</Text>
              <View style={styles.itemIcon}>
                <MaterialCommunityIcons name={KIND_ICONS[item.kind] as IconName} size={16} color={colors.primary} />
              </View>
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, text]}>{item.title}</Text>
                {item.description ? <Text style={[styles.itemDesc, text]}>{item.description}</Text> : null}
                {(item.placeName || item.distanceKm != null) && (
                  <Text style={[styles.itemPlace, text]}>
                    {[item.placeName, item.distanceKm != null ? t("fromCampsite").replace("{km}", String(item.distanceKm)) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}

      {[
        { title: t("packingList"), icon: "bag-personal-outline", entries: plan.packingList },
        { title: t("tips"), icon: "lightbulb-on-outline", entries: plan.tips },
      ].map(({ title, icon, entries }) =>
        entries.length ? (
          <View key={title} style={styles.listCard}>
            <View style={styles.listHeader}>
              <MaterialCommunityIcons name={icon as IconName} size={20} color={colors.primary} />
              <Text style={[styles.listTitle, text]}>{title}</Text>
            </View>
            {entries.map((entry, index) => (
              <View key={index} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, text]}>{entry}</Text>
              </View>
            ))}
          </View>
        ) : null
      )}

      <Text style={[styles.footnote, text]}>
        {t("disclaimer")}
        {"\n"}
        {t("osmCredit")}
      </Text>
    </ScrollView>
  );
}

function Chip({ icon, label, styles, colors }: { icon: IconName; label: string; styles: Styles; colors: ColorTokens }) {
  return (
    <View style={styles.chip}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.7 },
    appbar: { backgroundColor: colors.background },
    appbarTitle: { fontFamily: fonts.displayBold, color: colors.text, textAlign: "right" },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      minWidth: 36,
      justifyContent: "center",
      paddingHorizontal: 9,
      marginLeft: spacing.sm,
      borderRadius: 18,
    },
    deleteArmed: { backgroundColor: colors.danger },
    deleteArmedText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onPrimary },

    content: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
    contentDesktop: { width: "100%", maxWidth: 820, alignSelf: "center" },

    hero: { gap: spacing.sm },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: colors.text },
    summary: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTint,
    },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
    prefs: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

    pdfActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    pdfButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    pdfButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
    pdfButtonAlt: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pdfButtonAltText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
    pdfError: { fontFamily: fonts.body, fontSize: 13, color: colors.danger },

    day: {
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    dayHeader: { backgroundColor: colors.primaryTint, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    dayLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
    dayTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.text },
    camp: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.accentTint,
    },
    campText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accentDeep },
    item: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemLast: { borderBottomWidth: 0 },
    time: { width: 52, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary, textAlign: "right", paddingTop: 2 },
    itemIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    itemBody: { flex: 1, gap: 2 },
    itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
    itemDesc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.text },
    itemPlace: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

    listCard: {
      gap: 6,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    listHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
    listTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 17, color: colors.text },
    bulletRow: { flexDirection: "row", gap: spacing.sm },
    bullet: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accentDeep },
    bulletText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.text },

    footnote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.textFaint },
  });
}
