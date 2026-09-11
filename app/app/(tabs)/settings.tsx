import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { useLocale } from "@/context/LocaleContext";
import LanguageToggle from "@/components/LanguageToggle";
import { colors, spacing, typography } from "@/constants/theme";

export default function SettingsScreen() {
  const { t } = useLocale();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
        <LanguageToggle />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.about")}</Text>
        <Text style={styles.value}>CampingIL v{version}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  value: { ...typography.body, color: colors.textMuted },
});
