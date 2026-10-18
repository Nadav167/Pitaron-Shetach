import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Snackbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Campsite } from "@/types/campsite";
import { openNavigation } from "@/lib/navigation";
import { useLocale } from "@/context/LocaleContext";
import { spacing } from "@/constants/theme";

type Props = {
  campsite: Campsite;
  /** `compact` fits inside a card; `full` is the detail screen. */
  size?: "compact" | "full";
};

/**
 * Waze + Google Maps deep links, opened through React Native's Linking API.
 *
 * Both buttons stay enabled even when the site has no verified coordinates —
 * `navigationUrls` falls back to a name search in that case, which is exactly
 * what parks.org.il itself tells people to do ("כתבו בוויז: <name>"). The
 * caveat is carried by the "location not verified" line on the card, not by
 * disabling the button, because a name search still gets most people there.
 */
export default function NavigationButtons({ campsite, size = "compact" }: Props) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const compact = size === "compact";

  const open = async (app: "waze" | "googleMaps") => {
    const result = await openNavigation(campsite, app);
    if (!result.ok) setError(t("site.navigationFailed"));
  };

  return (
    <>
      <View style={styles.row}>
        <Button
          mode="contained-tonal"
          icon={rtlIcon("waze")}
          compact={compact}
          style={styles.button}
          contentStyle={compact ? styles.compactContent : undefined}
          labelStyle={compact ? styles.compactLabel : undefined}
          onPress={() => open("waze")}
          accessibilityLabel={`${t("site.navigateWaze")} – ${campsite.name.he}`}
        >
          {t("site.navigateWaze")}
        </Button>
        <Button
          mode="contained-tonal"
          icon={rtlIcon("google-maps")}
          compact={compact}
          style={styles.button}
          contentStyle={compact ? styles.compactContent : undefined}
          labelStyle={compact ? styles.compactLabel : undefined}
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
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  button: { flexGrow: 1, flexBasis: 0, minWidth: 120 },
  compactContent: { height: 34 },
  compactLabel: { fontSize: 12, marginHorizontal: spacing.sm },
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
