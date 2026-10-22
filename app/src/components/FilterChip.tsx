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
  /** Laid over the map: a shadow instead of a border, to stand off the tiles. */
  floating?: boolean;
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
 *
 * 40px tall (it was 37): with the 8px gap between rows that leaves no dead
 * zone a thumb can land in, close to the 44pt guideline without making the
 * row bulky.
 */
export default function FilterChip({ label, icon, selected, onPress, floating = false }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        floating && styles.chipFloating,
        selected && styles.chipActive,
        pressed && styles.pressed,
      ]}
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
      justifyContent: "center",
      gap: 6,
      minHeight: 40,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    chipFloating: {
      borderColor: "transparent",
      shadowColor: "#000",
      shadowOpacity: 0.14,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pressed: { opacity: 0.85 },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.text,
    },
    labelActive: {
      color: colors.onPrimary,
    },
  });
}
