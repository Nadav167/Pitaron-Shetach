import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { Locale } from "@/types/site";

type NavItem = { href: "/" | "/map" | "/favorites" | "/settings"; labelKey: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "tabs.home" },
  { href: "/map", labelKey: "tabs.map" },
  { href: "/favorites", labelKey: "tabs.favorites" },
  { href: "/settings", labelKey: "tabs.settings" },
];

/**
 * Top navigation bar shown instead of the floating bottom tab bar on wide
 * (desktop-width) screens — the layout the mockup's Home-Desktop artboard
 * specified but the first implementation pass left as mobile-only. Brand
 * mark, text nav links (active one highlighted), a language toggle and a
 * light/dark toggle, all in one row.
 */
export default function DesktopNav() {
  const { t, locale, setLocale } = useLocale();
  const { scheme, colors, toggleScheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const otherLocale: Locale = locale === "he" ? "en" : "he";

  return (
    <View style={styles.bar}>
      <Pressable style={styles.brand} onPress={() => router.push("/")}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="pine-tree" size={17} color={colors.onPrimary} />
        </View>
        <RNText style={styles.brandName}>{t("common.appName")}</RNText>
      </Pressable>

      <View style={styles.links}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Pressable key={item.href} onPress={() => router.push(item.href)}>
              <RNText style={[styles.link, active && styles.linkActive]}>{t(item.labelKey)}</RNText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.langChip} onPress={() => setLocale(otherLocale)}>
          <RNText style={styles.langChipText}>
            {t(locale === "he" ? "settings.hebrew" : "settings.english")}
          </RNText>
        </Pressable>
        <Pressable
          style={styles.themeButton}
          onPress={toggleScheme}
          accessibilityLabel={t(scheme === "dark" ? "settings.light" : "settings.dark")}
        >
          <MaterialCommunityIcons
            name={scheme === "dark" ? "white-balance-sunny" : "moon-waning-crescent"}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
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
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    langChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentTint,
    },
    langChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accentDeep },
    themeButton: {
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
