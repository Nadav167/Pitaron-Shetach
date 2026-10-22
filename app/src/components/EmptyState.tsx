import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";

type Props = {
  message: string;
  /** Shown in a tinted circle above the message. */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** A way out of the empty screen, e.g. "Browse the map". */
  action?: { label: string; onPress: () => void };
};

export default function EmptyState({ message, icon, action }: Props) {
  const { writingDirection } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={icon} size={30} color={colors.primary} />
        </View>
      )}
      <Text style={[styles.text, { writingDirection }]}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.lg,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 320,
    },
    button: {
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  });
}
