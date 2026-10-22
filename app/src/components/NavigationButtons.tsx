import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Snackbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { openNavigation } from "@/lib/navigation";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { fonts, radius, spacing } from "@/constants/theme";

type Props = {
  campsite: Campsite;
};

/**
 * Waze + Google Maps deep links, opened through React Native's Linking API.
 * Waze is the filled, primary button: it's what most people in Israel
 * drive with.
 *
 * Both buttons stay enabled even when the site has no verified coordinates —
 * `navigationUrls` falls back to a name search in that case, which is exactly
 * what parks.org.il itself tells people to do ("כתבו בוויז: <name>"). The
 * caveat is carried by the "location not verified" line on the page, not by
 * disabling the button, because a name search still gets most people there.
 */
export default function NavigationButtons({ campsite }: Props) {
  const { t } = useLocale();
  const colors = useThemeColors();
  const [error, setError] = useState<string | null>(null);

  const open = async (app: "waze" | "googleMaps") => {
    const result = await openNavigation(campsite, app);
    if (!result.ok) setError(t("site.navigationFailed"));
  };

  return (
    <>
      <View style={styles.row}>
        <Button
          mode="contained"
          icon={rtlIcon("waze")}
          style={styles.button}
          contentStyle={styles.content}
          labelStyle={styles.label}
          onPress={() => open("waze")}
          accessibilityLabel={`${t("site.navigateWaze")} – ${campsite.name.he}`}
        >
          {t("site.navigateWaze")}
        </Button>
        <Button
          mode="outlined"
          icon={rtlIcon("google-maps")}
          style={[styles.button, { borderColor: colors.primary }]}
          contentStyle={styles.content}
          labelStyle={styles.label}
          onPress={() => open("googleMaps")}
          accessibilityLabel={`${t("site.navigateGoogleMaps")} – ${campsite.name.he}`}
        >
          {t("site.navigateGoogleMaps")}
        </Button>
      </View>

      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={4000}>
        {error ?? ""}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1, borderRadius: radius.md },
  content: { height: 50 },
  // Paper's default label margins plus the icon left "Google Maps" cut to
  // "Google Ma…" at phone width; tighter margins let both labels fit.
  label: { fontFamily: fonts.bodyBold, fontSize: 15, marginHorizontal: spacing.sm },
});

/**
 * Paper's Button places its icon with physical, left-to-right margins (a
 * negative right margin meant to tuck it toward the label in LTR). In this
 * app's right-to-left layout the icon sits on the right instead, so that
 * negative margin pushed it past the button's edge. The extra right margin
 * here cancels it out.
 */
function rtlIcon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return function ButtonIcon({ size, color }: { size: number; color: string }) {
    return <MaterialCommunityIcons name={name} size={size} color={color} style={{ marginRight: spacing.md }} />;
  };
}
