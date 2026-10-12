import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";

type Props = {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Custom pill replacing React Native Paper's <Chip> for the Home filter row,
 * for two reasons:
 * 1) Paper's MD3 selected-chip styling routes through `secondaryContainer`
 *    (an amber tint here) plus an automatic checkmark overlay — the mockup's
 *    active chip is a plain solid-primary pill with no checkmark, which
 *    fighting Paper's theme can't cleanly produce.
 * 2) Paper's Chip hardcodes *physical* marginLeft/marginRight for the
 *    icon-to-label gap, which doesn't mirror under RTL (same category of bug
 *    fixed on List.Item in the detail screen) — a Pressable we build
 *    ourselves mirrors for free via flexDirection: row + inherited CSS
 *    direction, no manual overrides needed.
 */
export default function FilterChip({ label, icon, selected, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
          size={15}
          color={selected ? colors.onPrimary : colors.textMuted}
        />
      )}
      <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.onPrimary,
    },
  });
}
