import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import HoverTip from "@/components/HoverTip";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { Locale } from "@/types/site";

type Props = {
  /** Adds an "About" icon button — for the mobile header, which has no room
   *  for the text link the desktop nav uses. */
  showAbout?: boolean;
};

/**
 * The language and light/dark toggles, shared by the desktop nav and the
 * mobile header so both are always one tap away at every screen width. (They
 * used to exist only in the desktop nav, with a Settings tab as the mobile
 * route to them; that tab held nothing else, so it was removed.)
 */
export default function HeaderActions({ showAbout = false }: Props) {
  const { t, locale, setLocale } = useLocale();
  const { scheme, colors, toggleScheme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const otherLocale: Locale = locale === "he" ? "en" : "he";
  const themeLabel = t(scheme === "dark" ? "header.lightMode" : "header.darkMode");

  return (
    <View style={styles.actions}>
      {/* These controls sit against the left edge of the window (the
          trailing edge of the right-to-left header), so their hover labels
          are left-aligned to open inward instead of off-screen. */}
      {showAbout && (
        <HoverTip label={t("about.title")} align="left">
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/about")}
            accessibilityRole="button"
            accessibilityLabel={t("about.title")}
          >
            <MaterialCommunityIcons name="information-outline" size={17} color={colors.textMuted} />
          </Pressable>
        </HoverTip>
      )}
      <HoverTip label={t("header.switchLanguage")} align="left">
        <Pressable
          style={styles.langChip}
          onPress={() => setLocale(otherLocale)}
          accessibilityRole="button"
          accessibilityLabel={t("header.switchLanguage")}
        >
          <RNText style={styles.langChipText}>{t(locale === "he" ? "header.hebrew" : "header.english")}</RNText>
        </Pressable>
      </HoverTip>
      <HoverTip label={themeLabel} align="left">
        <Pressable
          style={styles.iconButton}
          onPress={toggleScheme}
          accessibilityRole="button"
          accessibilityLabel={themeLabel}
        >
          <MaterialCommunityIcons
            name={scheme === "dark" ? "white-balance-sunny" : "moon-waning-crescent"}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
      </HoverTip>
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    langChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentTint,
    },
    langChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accentDeep },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
