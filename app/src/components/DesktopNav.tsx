import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import HeaderActions from "@/components/HeaderActions";
import { useAuth } from "@/context/AuthContext";
import { fonts, spacing, type ColorTokens } from "@/constants/theme";

/** `show`: only when accounts are configured / only while signed in. */
type NavItem = { href: Href; path: string; labelKey: string; show?: "accounts" | "signedIn" };

const NAV_ITEMS: NavItem[] = [
  { href: "/", path: "/", labelKey: "tabs.home" },
  { href: "/map", path: "/map", labelKey: "tabs.map" },
  { href: "/favorites", path: "/favorites", labelKey: "tabs.favorites" },
  { href: "/agent", path: "/agent", labelKey: "tabs.agent", show: "accounts" },
  { href: "/itineraries", path: "/itineraries", labelKey: "tabs.itineraries", show: "signedIn" },
  { href: "/about", path: "/about", labelKey: "about.title" },
];

/**
 * Top navigation bar shown instead of the floating bottom tab bar on wide
 * (desktop-width) screens. Brand mark, text nav links (active one
 * highlighted), and the language and light/dark toggles, all in one row.
 */
export default function DesktopNav() {
  const { t } = useLocale();
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Same visibility rules as the tab bar (see (tabs)/_layout).
  const { enabled: accountsEnabled, status } = useAuth();
  const items = NAV_ITEMS.filter(
    (item) => !item.show || (item.show === "accounts" ? accountsEnabled : status === "signedIn")
  );

  return (
    <View style={styles.bar}>
      <Pressable style={styles.brand} onPress={() => router.push("/")}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="pine-tree" size={17} color={colors.onPrimary} />
        </View>
        <RNText style={styles.brandName}>{t("common.appName")}</RNText>
      </Pressable>

      <View style={styles.links}>
        {items.map((item) => {
          const active = pathname === item.path;
          return (
            <Pressable key={item.path} onPress={() => router.push(item.href)} accessibilityRole="link">
              <RNText style={[styles.link, active && styles.linkActive]}>{t(item.labelKey)}</RNText>
            </Pressable>
          );
        })}
      </View>

      <HeaderActions />
    </View>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 72,
      paddingHorizontal: spacing.xl,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      // Hover labels hang below the bar, over the page content.
      zIndex: 10,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandMark: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
    links: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
    link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted },
    linkActive: { color: colors.text },
  });
}
