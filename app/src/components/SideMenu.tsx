import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import BrandMark from "@/components/BrandMark";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** `show`: only when accounts are configured / only while signed in
 *  (the same rules as the desktop nav). */
type NavItem = { href: Href; path: string; labelKey: string; icon: IconName; show?: "accounts" | "signedIn" };

const NAV_ITEMS: NavItem[] = [
  { href: "/", path: "/", labelKey: "tabs.home", icon: "home-outline" },
  { href: "/map", path: "/map", labelKey: "tabs.map", icon: "map-outline" },
  { href: "/favorites", path: "/favorites", labelKey: "tabs.favorites", icon: "heart-outline" },
  { href: "/agent", path: "/agent", labelKey: "tabs.agent", icon: "compass-outline", show: "accounts" },
  { href: "/itineraries", path: "/itineraries", labelKey: "tabs.itineraries", icon: "map-marker-path", show: "signedIn" },
];

const SLIDE_MS = 220;

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * The phone-width navigation, web and native (Nadav 2026-10-22: a side menu
 * behind the ☰ button instead of the floating bottom tab bar). It slides in from the
 * right, the side the right-to-left layout starts on, over a dimmed page:
 * the app's pages, the current one highlighted, then About, language and
 * day/night.
 *
 * Closes on a choice, a tap on the dimmed page, the close button, or Escape
 * (react-native-web's Modal reports Escape through onRequestClose).
 */
export default function SideMenu({ visible, onClose }: Props) {
  const { t, locale, setLocale, writingDirection } = useLocale();
  const { scheme, colors, toggleScheme } = useTheme();
  const { enabled: accountsEnabled, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.84));
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  // The Modal stays mounted until the closing slide has finished.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const items = NAV_ITEMS.filter(
    (item) => !item.show || (item.show === "accounts" ? accountsEnabled : status === "signedIn")
  );

  // Navigate after starting to close, so the new page appears under the
  // sliding panel rather than after it.
  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const row = (key: string, icon: IconName, label: string, onPress: () => void, active = false) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && styles.rowPressed]}
      accessibilityRole={active ? "button" : "link"}
      accessibilityState={{ selected: active }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.rowText, active && styles.rowTextActive]}>{label}</Text>
    </Pressable>
  );

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("header.closeMenu")} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) }],
          },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <BrandMark style={styles.brandMark} size={32} />
            <Text style={styles.brandName}>{t("common.appName")}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t("header.closeMenu")}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {items.map((item) => row(item.path, item.icon, t(item.labelKey), () => go(item.href), pathname === item.path))}

          <View style={styles.divider} />

          {row("about", "information-outline", t("about.title"), () => go("/about"), pathname === "/about")}
          {/* Named in the language it switches TO, so someone who can't
              read the current one can still find it. */}
          {row("language", "translate", locale === "he" ? "English" : "עברית", () => {
            onClose();
            setLocale(locale === "he" ? "en" : "he");
          })}
          {row(
            "theme",
            scheme === "dark" ? "white-balance-sunny" : "moon-waning-crescent",
            t(scheme === "dark" ? "header.lightMode" : "header.darkMode"),
            () => {
              onClose();
              toggleScheme();
            }
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,18,14,0.45)" },
    // Physical right: the start of the right-to-left layout.
    panel: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderBottomLeftRadius: radius.lg,
      paddingHorizontal: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
      elevation: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
    closeButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
    body: { gap: 2, paddingBottom: spacing.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: colors.primaryTint },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, ...text },
    rowTextActive: { fontFamily: fonts.bodyBold, color: colors.primary },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
      marginHorizontal: spacing.md,
    },
  });
}
