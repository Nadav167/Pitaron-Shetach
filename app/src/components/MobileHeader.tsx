import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import HeaderActions from "@/components/HeaderActions";
import { fonts, spacing, type ColorTokens } from "@/constants/theme";

/**
 * Top bar for phone-width screens, the counterpart of DesktopNav: the brand
 * on one side, and the About / language / light-dark controls on the other.
 * It sits above every tab, so those controls are reachable from Home, Map
 * and Favorites alike. Navigation between the tabs themselves stays in the
 * floating bottom bar.
 */
export default function MobileHeader() {
  const { t } = useLocale();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable style={styles.brand} onPress={() => router.push("/")} accessibilityRole="link">
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="pine-tree" size={18} color={colors.onPrimary} />
        </View>
        <RNText style={styles.brandName}>{t("common.appName")}</RNText>
      </Pressable>
      <HeaderActions showAbout />
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
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      // Hover labels hang below the bar, over the page content.
      zIndex: 10,
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
    brandName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  });
}
