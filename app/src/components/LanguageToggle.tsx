import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@/context/LocaleContext";
import { colors, radius, spacing, typography } from "@/constants/theme";

export default function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <View style={styles.row}>
      {(["he", "en"] as const).map((code) => {
        const active = locale === code;
        return (
          <Pressable
            key={code}
            onPress={() => setLocale(code)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {code === "he" ? t("settings.hebrew") : t("settings.english")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { ...typography.body, color: colors.text },
  labelActive: { color: colors.surface, fontWeight: "700" },
});
