import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { radius, spacing, type ColorTokens } from "@/constants/theme";

type Props = {
  /** `compact` for cards and map popups, `full` for the detail screen. */
  variant?: "compact" | "full";
};

/**
 * Shown on every non-official campsite.
 *
 * Non-official records come from a third-party directory (gocamping.co.il),
 * which republishes prices, hours and phone numbers that the campsite owners
 * don't control. Several listings there are stale by years — one is marked
 * "closed until further notice" — so the warning is not boilerplate caution,
 * it's the honest state of the data.
 *
 * Deliberately small and low-contrast-but-legible: it has to register without
 * making the listing look like a scam, since most of these are real places.
 */
export default function UnofficialNotice({ variant = "compact" }: Props) {
  const { t, isRTL } = useLocale();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);

  return (
    <View style={[styles.container, variant === "full" && styles.full]}>
      <Text
        variant={variant === "full" ? "bodySmall" : "labelSmall"}
        style={styles.text}
        accessibilityRole="alert"
      >
        {`⚠️ ${t("site.unofficialWarning")}`}
      </Text>
    </View>
  );
}

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      alignSelf: "flex-start",
      backgroundColor: colors.accentTint,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
    },
    full: {
      alignSelf: "stretch",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless
    // of RTL (see Typography/Text.tsx) -- override explicitly.
    text: { color: colors.accentDeep, textAlign: isRTL ? "right" : "left" },
  });
}
