import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Opens the filter sheet (sort, region, free only). */
  onOpenFilters: () => void;
  /** Settings in the sheet that differ from the defaults; badge on the button. */
  activeFilterCount: number;
  /** Over the map the bar needs a stronger shadow to stand off the tiles. */
  floating?: boolean;
};

/**
 * The search pill from the mockup's Home artboards. The trailing round
 * button opens the filter sheet (FilterSheet). It used to open a menu that
 * only sorted, behind a "sliders" icon that promised filters.
 */
export default function SearchBar({ value, onChangeText, onOpenFilters, activeFilterCount, floating = false }: Props) {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const filterLabel =
    activeFilterCount > 0
      ? t("filters.buttonActive").replace("{count}", String(activeFilterCount))
      : t("filters.button");

  return (
    <View style={[styles.pill, floating && styles.floating]}>
      <MaterialCommunityIcons name="magnify" size={19} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t("home.searchPlaceholder")}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t("home.searchLabel")}
        returnKeyType="search"
        // Row mirroring comes from the inherited CSS `direction` (see
        // LocaleContext), but a text input's own text-align doesn't follow
        // that on every platform/browser, so it is set outright. Always
        // right-aligned, like the rest of the layout; the reading direction
        // follows the language so the placeholder's punctuation lands on
        // the correct side.
        style={[styles.input, { textAlign: "right", writingDirection }]}
      />
      {value !== "" && (
        <Pressable
          onPress={() => onChangeText("")}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel={t("home.clearSearch")}
        >
          <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      <Pressable
        onPress={onOpenFilters}
        style={styles.filterButton}
        accessibilityRole="button"
        accessibilityLabel={filterLabel}
      >
        <MaterialCommunityIcons name="tune-variant" size={18} color={colors.onPrimary} />
        {activeFilterCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 52,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingStart: spacing.md,
      paddingEnd: 4,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    floating: { shadowOpacity: 0.16, shadowRadius: 14, elevation: 6 },
    input: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 12,
    },
    clearButton: { width: 36, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
    filterButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    // Top-left corner of the button: physical, like the rest of the fixed
    // right-to-left layout (see LocaleContext).
    badge: {
      position: "absolute",
      top: 0,
      left: 0,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.onAccent },
  });
}
