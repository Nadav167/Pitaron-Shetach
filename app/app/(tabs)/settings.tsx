import React from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { List, SegmentedButtons, Text } from "react-native-paper";
import { useLocale } from "@/context/LocaleContext";
import { colors, spacing } from "@/constants/theme";
import type { Locale } from "@/types/site";

export default function SettingsScreen() {
  const { locale, setLocale, t } = useLocale();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <View style={styles.container}>
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
        <List.Subheader>{t("settings.about")}</List.Subheader>
        <List.Item
          title={`CampingIL v${version}`}
          left={(props) => <List.Icon {...props} icon="information-outline" />}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { marginBottom: spacing.sm },
  segmented: { marginHorizontal: spacing.md, marginTop: spacing.xs },
});
