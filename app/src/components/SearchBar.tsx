import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Menu } from "react-native-paper";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { SortMode } from "@/lib/sort";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
};

const SORT_OPTIONS: SortMode[] = ["default", "priceAsc", "priceDesc", "region"];

/**
 * The search pill from the mockup's Home artboards (mobile and desktop both
 * had one; the first real-app pass missed it entirely — that was fixed
 * earlier). The trailing round button opens a sort menu (price low/high,
 * region north-to-south) — it used to be purely decorative, which is why
 * tapping it did nothing.
 */
export default function SearchBar({ value, onChangeText, sortMode, onSortModeChange }: Props) {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.pill}>
      <MaterialCommunityIcons name="magnify" size={19} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t("home.searchPlaceholder")}
        placeholderTextColor={colors.textFaint}
        // Row mirroring comes from the inherited CSS `direction` (see
        // LocaleContext), but a text input's own text-align doesn't follow
        // that on every platform/browser, so it is set outright. Always
        // right-aligned, like the rest of the layout; the reading direction
        // follows the language so the placeholder's punctuation lands on
        // the correct side.
        style={[styles.input, { textAlign: "right", writingDirection }]}
      />
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={styles.filterButton}
            accessibilityRole="button"
            accessibilityLabel={t("home.sort.label")}
          >
            <MaterialCommunityIcons name="tune-variant" size={17} color={colors.onPrimary} />
          </Pressable>
        }
      >
        {SORT_OPTIONS.map((mode) => (
          <Menu.Item
            key={mode}
            onPress={() => {
              onSortModeChange(mode);
              setMenuVisible(false);
            }}
            title={t(`home.sort.${mode}`)}
            leadingIcon={sortMode === mode ? "check" : undefined}
          />
        ))}
      </Menu>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    input: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 14.5,
      color: colors.text,
      paddingVertical: 0,
    },
    filterButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
