import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Menu } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import AccountButton from "@/components/AccountButton";
import { fonts, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

/**
 * Top bar for phone-width screens, the counterpart of DesktopNav: the brand
 * on one side; the account button and a "more" (⋯) menu on the other.
 *
 * The language, day/night and About controls used to sit in this row as
 * separate buttons (HeaderActions, which the desktop nav still uses). Five
 * controls and the brand don't fit in 358px: the log-in chip was squeezed
 * to "הר" in Hebrew, and in English the day/night button was pushed off the
 * screen. They now live in the menu, which leaves two 44px buttons that
 * fit in either language, signed in or out.
 */
export default function MobileHeader() {
  const { t, locale, setLocale, writingDirection } = useLocale();
  const { scheme, colors, toggleScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuVisible, setMenuVisible] = useState(false);

  const itemTitle = { fontFamily: fonts.bodyMedium, textAlign: "right" as const, writingDirection };
  // Run the action after the menu has closed, so a re-render it causes
  // (the language or theme changing) doesn't fight the closing animation.
  const choose = (action: () => void) => () => {
    setMenuVisible(false);
    action();
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <Pressable style={styles.brand} onPress={() => router.push("/")} accessibilityRole="link" accessibilityLabel={t("common.appName")}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="pine-tree" size={18} color={colors.onPrimary} />
        </View>
        <RNText style={styles.brandName}>{t("common.appName")}</RNText>
      </Pressable>
      <View style={styles.actions}>
        <AccountButton compact />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchorPosition="bottom"
          anchor={
            <Pressable
              style={styles.moreButton}
              onPress={() => setMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("header.more")}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text} />
            </Pressable>
          }
        >
          <Menu.Item
            leadingIcon="translate"
            // Named in the language it switches TO, so someone who can't
            // read the current one can still find it.
            title={locale === "he" ? "English" : "עברית"}
            titleStyle={itemTitle}
            onPress={choose(() => setLocale(locale === "he" ? "en" : "he"))}
            accessibilityLabel={t("header.switchLanguage")}
          />
          <Menu.Item
            leadingIcon={scheme === "dark" ? "white-balance-sunny" : "moon-waning-crescent"}
            title={t(scheme === "dark" ? "header.lightMode" : "header.darkMode")}
            titleStyle={itemTitle}
            onPress={choose(toggleScheme)}
          />
          <Menu.Item
            leadingIcon="information-outline"
            title={t("about.title")}
            titleStyle={itemTitle}
            onPress={choose(() => router.push("/about"))}
          />
        </Menu>
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
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
      zIndex: 10,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minHeight: TOUCH_TARGET },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginStart: spacing.sm },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    moreButton: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
