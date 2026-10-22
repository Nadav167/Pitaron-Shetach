import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing, TOUCH_TARGET, type ColorTokens } from "@/constants/theme";

type Props = {
  /**
   * The phone header's form: a round 44px icon button (the person's
   * initial once signed in) instead of a labelled chip. A phone-width row
   * had no room for the chip next to the other controls; in Hebrew it was
   * squeezed down to "הר" and in English it was covered.
   */
  compact?: boolean;
};

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
export default function AccountButton({ compact = false }: Props) {
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
        style={compact ? styles.round : styles.chip}
        onPress={() => router.push("/login")}
        accessibilityRole="button"
        accessibilityLabel={t("header.logIn")}
      >
        <MaterialCommunityIcons
          name="account-circle-outline"
          size={compact ? 22 : 16}
          color={colors.primary}
        />
        {!compact && <RNText style={styles.chipText}>{t("header.logIn")}</RNText>}
      </Pressable>
    );
  }

  const welcome = t("header.welcome").replace("{name}", profile?.firstName ?? "");
  const initial = profile?.firstName?.trim().charAt(0) ?? "";

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchorPosition="bottom"
      anchor={
        compact ? (
          <Pressable
            style={styles.round}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={welcome}
            accessibilityHint={t("header.logOut")}
          >
            {initial ? (
              <View style={styles.initialBadge}>
                <RNText style={styles.initialText}>{initial}</RNText>
              </View>
            ) : (
              <MaterialCommunityIcons name="account-circle" size={22} color={colors.primary} />
            )}
          </Pressable>
        ) : (
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
        )
      }
    >
      {/* The compact button shows only an initial, so the greeting moves
          into the menu, where there is room for the whole name. */}
      {compact && (
        <Menu.Item
          title={welcome}
          disabled
          titleStyle={{ fontFamily: fonts.bodyBold, color: colors.text, textAlign: "right", writingDirection }}
        />
      )}
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
    round: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      borderRadius: TOUCH_TARGET / 2,
      backgroundColor: colors.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    initialBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    initialText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
  });
}
