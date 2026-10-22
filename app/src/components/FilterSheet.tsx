import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import FilterChip from "@/components/FilterChip";
import { REGIONS_NORTH_TO_SOUTH, type SiteFilters } from "@/hooks/useSiteFilters";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";
import type { SortMode } from "@/lib/sort";

const SORT_OPTIONS: SortMode[] = ["default", "priceAsc", "priceDesc", "region"];

type Props = {
  filters: SiteFilters;
  visible: boolean;
  onClose: () => void;
};

/**
 * Bottom sheet behind the search bar's filter button: sort order, regions
 * and "free only". The kind of site (night camp / campground) stays in the
 * chip row under the search bar, where it is one tap away. Amenities are
 * not offered: only 3-4 of the 405 sites have any amenity data, so such a
 * filter would empty the list.
 *
 * Changes apply immediately (the list behind the sheet updates as you tap);
 * the footer button only closes the sheet and says how many sites match.
 * On desktop-width screens the same sheet is centered and width-capped.
 */
export default function FilterSheet({ filters, visible, onClose }: Props) {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const showLabel = t("filters.show").replace("{count}", String(filters.visible.length));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("filters.close")} />
        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title} accessibilityRole="header">
              {t("filters.title")}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t("filters.close")}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.sectionTitle}>{t("home.sort.label")}</Text>
            <View accessibilityRole="radiogroup">
              {SORT_OPTIONS.map((mode) => {
                const selected = filters.sortMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => filters.setSortMode(mode)}
                    style={styles.optionRow}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <MaterialCommunityIcons
                      name={selected ? "radiobox-marked" : "radiobox-blank"}
                      size={22}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.optionText}>{t(`home.sort.${mode}`)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>{t("filters.regions")}</Text>
            <View style={styles.chipWrap}>
              {REGIONS_NORTH_TO_SOUTH.map((region) => (
                <FilterChip
                  key={region}
                  label={t(`region.${region}`)}
                  selected={filters.regions.has(region)}
                  onPress={() => filters.toggleRegion(region)}
                />
              ))}
            </View>

            <Pressable
              style={styles.switchRow}
              onPress={() => filters.setFreeOnly(!filters.freeOnly)}
              accessibilityRole="switch"
              accessibilityState={{ checked: filters.freeOnly }}
            >
              <Text style={styles.optionText}>{t("filters.freeOnly")}</Text>
              <Switch
                value={filters.freeOnly}
                onValueChange={filters.setFreeOnly}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={filters.freeOnly ? colors.primary : colors.surface}
                // The whole row is the control for screen readers.
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={filters.resetSheetFilters}
              style={styles.resetButton}
              disabled={filters.sheetFilterCount === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: filters.sheetFilterCount === 0 }}
            >
              <Text style={[styles.resetText, filters.sheetFilterCount === 0 && styles.resetDisabled]}>{t("filters.reset")}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.showButton} accessibilityRole="button">
              <Text style={styles.showText}>{showLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,18,14,0.45)" },
    sheet: {
      width: "100%",
      maxWidth: 560,
      maxHeight: "88%",
      alignSelf: "center",
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.xs,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontFamily: fonts.display, fontSize: 20, color: colors.text, ...text },
    closeButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
    body: { paddingBottom: spacing.md },
    sectionTitle: {
      fontFamily: fonts.displayBold,
      fontSize: 15,
      color: colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      ...text,
    },
    optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: TOUCH_TARGET },
    optionText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, ...text },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 52,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    resetButton: { minHeight: 48, paddingHorizontal: spacing.md, justifyContent: "center" },
    resetText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary, textDecorationLine: "underline" },
    resetDisabled: { color: colors.textFaint, textDecorationLine: "none" },
    showButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    showText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  });
}
