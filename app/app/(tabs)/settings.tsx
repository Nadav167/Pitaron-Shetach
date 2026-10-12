import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { List, SegmentedButtons, Text } from "react-native-paper";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { spacing, fonts, type ColorTokens } from "@/constants/theme";
import type { Locale } from "@/types/site";

export default function SettingsScreen() {
  const { locale, setLocale, t, isRTL } = useLocale();
  const { scheme, setScheme, colors } = useTheme();
  const { isDesktop } = useResponsive();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  const styles = useMemo(() => makeStyles(colors, isRTL), [colors, isRTL]);

  return (
    <View style={styles.container}>
      {/* Capped and centered on wide windows — these settings rows used to
          stretch edge to edge on desktop, same issue as Home before it got
          this treatment. */}
      <View style={isDesktop ? styles.desktopContainer : styles.fill}>
        <Text variant="headlineSmall" style={styles.title}>
          {t("settings.title")}
        </Text>

        <List.Section>
          <List.Subheader>{t("settings.language")}</List.Subheader>
          <SegmentedButtons
            style={styles.segmented}
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
            buttons={[
              { value: "he", label: t("settings.hebrew") },
              { value: "en", label: t("settings.english") },
            ]}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>{t("settings.appearance")}</List.Subheader>
          <SegmentedButtons
            style={styles.segmented}
            value={scheme}
            onValueChange={(value) => setScheme(value as "light" | "dark")}
            buttons={[
              { value: "light", label: t("settings.light"), icon: "white-balance-sunny" },
              { value: "dark", label: t("settings.dark"), icon: "moon-waning-crescent" },
            ]}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>{t("settings.about")}</List.Subheader>
          <List.Item
            title={`CampingIL v${version}`}
            left={(props) => <List.Icon {...props} icon="information" />}
          />
        </List.Section>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorTokens, isRTL: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    fill: { flex: 1 },
    desktopContainer: { flex: 1, width: "100%", maxWidth: 700, marginHorizontal: "auto" },
    // react-native-paper's <Text> hardcodes textAlign: 'left' regardless of
    // RTL -- override explicitly (same fix as the detail screen).
    title: { marginBottom: spacing.sm, fontFamily: fonts.display, color: colors.text, textAlign: isRTL ? "right" : "left" },
    segmented: { marginHorizontal: spacing.md, marginTop: spacing.xs },
  });
}
