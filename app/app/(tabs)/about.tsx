import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { CONTACT_EMAIL } from "@/constants/contact";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";

const SECTIONS = [
  { title: "about.whatTitle", paragraphs: ["about.whatBody"] },
  { title: "about.accuracyTitle", paragraphs: ["about.accuracyBody", "about.independent"] },
];

/**
 * About page: what the site is, how far to trust its data, and how to get
 * in touch. Reached from the "About" link in the desktop nav and the info
 * button in the mobile header. It sits in the (tabs) group, so it gets the
 * same top bar as the other pages. All copy lives in the i18n dictionaries
 * under `about`.
 */
export default function AboutScreen() {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const clearance = useTabBarClearance();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: clearance }, isDesktop && styles.contentDesktop]}>
        <Text variant="titleMedium" style={styles.pageTitle}>
          {t("about.title")}
        </Text>
        <Text style={styles.brand}>{t("common.appName")}</Text>
        <Text variant="bodyMedium" style={styles.slogan}>
          {t("common.slogan")}
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t(section.title)}
            </Text>
            {section.paragraphs.map((key) => (
              <Text key={key} variant="bodyMedium" style={styles.paragraph}>
                {t(key)}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t("about.contactTitle")}
          </Text>
          <Text variant="bodyMedium" style={styles.paragraph}>
            {t("about.contactBody")}
          </Text>
          {CONTACT_EMAIL ? (
            <Text
              variant="bodyMedium"
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            >
              {CONTACT_EMAIL}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  // Paper's <Text> pins textAlign to 'left' (and writingDirection to 'ltr'
  // on web), so both are stated on every text style. Alignment is always
  // right — the layout doesn't change with the language.
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // The bottom padding clears the floating tab bar on phone-width screens.
    content: { padding: spacing.md },
    pageTitle: { fontFamily: fonts.displayBold, color: colors.textMuted, marginBottom: spacing.xs, ...text },
    contentDesktop: { width: "100%", maxWidth: 800, marginHorizontal: "auto" },
    brand: { fontFamily: fonts.display, fontSize: 30, color: colors.text, ...text },
    slogan: { color: colors.textMuted, marginTop: spacing.xs, ...text },
    section: {
      marginTop: spacing.lg,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sectionTitle: { fontFamily: fonts.displayBold, color: colors.text, ...text },
    paragraph: { color: colors.textMuted, lineHeight: 22, ...text },
    link: { color: colors.primary, fontFamily: fonts.bodyBold, textAlign: "right" },
  });
}
