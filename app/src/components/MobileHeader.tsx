import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import BrandMark from "@/components/BrandMark";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import AccountButton from "@/components/AccountButton";
import SideMenu from "@/components/SideMenu";
import { fonts, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

/**
 * Top bar for phone-width screens (web and the native app), the
 * counterpart of DesktopNav: a ☰ button and the brand at the start of the
 * row, the account button at the end.
 *
 * Navigation lives in the side menu behind ☰ (SideMenu), along with About,
 * language and day/night (Nadav 2026-10-22: a side menu instead of the
 * floating bottom tab bar, first on phone web, then in the app too). That
 * leaves the row two 44px buttons and the brand, which fit in either
 * language, signed in or out; the five separate buttons it used to hold
 * did not (the log-in chip was squeezed to "הר").
 */
export default function MobileHeader() {
  const { t } = useLocale();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.start}>
        <Pressable
          style={styles.menuButton}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("header.menu")}
          accessibilityState={{ expanded: menuOpen }}
        >
          <MaterialCommunityIcons name="menu" size={26} color={colors.text} />
        </Pressable>
        <Pressable style={styles.brand} onPress={() => router.push("/")} accessibilityRole="link" accessibilityLabel={t("common.appName")}>
          <BrandMark style={styles.brandMark} size={32} />
          <RNText style={styles.brandName}>{t("common.appName")}</RNText>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <AccountButton compact />
      </View>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
      zIndex: 10,
    },
    start: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
    // Pulled toward the screen edge so the icon, not its hit area, lines up
    // with the 16px gutter.
    menuButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      marginEnd: -spacing.xs,
      marginStart: -10,
      alignItems: "center",
      justifyContent: "center",
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minHeight: TOUCH_TARGET },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginStart: spacing.sm },
  });
}
