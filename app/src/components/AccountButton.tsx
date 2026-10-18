import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";

/**
 * The header's account control, placed just to the right of the language
 * button.
 *
 *   Signed out  a "Log in" chip that opens the login screen (which links on
 *               to registration).
 *   Signed in   "Welcome, <first name>"; tapping it opens a small menu
 *               with "Log out". One chip rather than a greeting plus a
 *               separate log-out button keeps the phone header on one row.
 *
 * Renders nothing while the session is being restored (so a signed-in user
 * never sees "Log in" flash first), or when the app was built without
 * Supabase keys.
 */
export default function AccountButton() {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { enabled, status, profile, logOut } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [menuVisible, setMenuVisible] = useState(false);
  // Paper's Menu wraps the chip in a View that doesn't shrink, so on the
  // narrowest phones the chip's width is capped outright instead.
  const { width } = useWindowDimensions();
  const chipMaxWidth = width < 360 ? 115 : 170;

  if (!enabled || status === "loading") return null;

  if (status === "signedOut") {
    return (
      <Pressable
        style={styles.chip}
        onPress={() => router.push("/login")}
        accessibilityRole="button"
        accessibilityLabel={t("header.logIn")}
      >
        <MaterialCommunityIcons name="account-circle-outline" size={16} color={colors.primary} />
        <RNText style={styles.chipText}>{t("header.logIn")}</RNText>
      </Pressable>
    );
  }

  const welcome = t("header.welcome").replace("{name}", profile?.firstName ?? "");

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchorPosition="bottom"
      anchor={
        <Pressable
          style={[styles.chip, { maxWidth: chipMaxWidth }]}
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={welcome}
          accessibilityHint={t("header.logOut")}
        >
          <MaterialCommunityIcons name="account-circle" size={16} color={colors.primary} />
          <RNText style={[styles.chipText, { writingDirection }]} numberOfLines={1}>
            {welcome}
          </RNText>
          <MaterialCommunityIcons name="chevron-down" size={15} color={colors.textMuted} />
        </Pressable>
      }
    >
      <Menu.Item
        leadingIcon="logout"
        title={t("header.logOut")}
        titleStyle={{ fontFamily: fonts.bodyMedium, textAlign: "right", writingDirection }}
        onPress={() => {
          setMenuVisible(false);
          // logOut always clears the session on this device (see
          // services/account.ts); nothing to report if it throws anyway.
          logOut().catch(() => {});
        }}
      />
    </Menu>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTint,
      // Long first names are cut off rather than pushing the header apart.
      maxWidth: 170,
      flexShrink: 1,
      minWidth: 0,
    },
    chipText: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
  });
}
