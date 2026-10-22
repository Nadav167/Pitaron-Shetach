import React, { forwardRef, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import { AccountError, MIN_PASSWORD_LENGTH } from "@/services/account";

/**
 * Building blocks shared by the login and register screens: the page frame
 * (title, subtitle, card), a labeled text field, the submit button and the
 * error box. Plain React Native rather than Paper's TextInput, whose
 * floating label and outline are positioned for left-to-right layouts.
 *
 * Like the rest of the app, the layout is always right-to-left; only the
 * reading direction of the text follows the language. Email and password
 * are always typed left-to-right.
 */

function useStyles() {
  const colors = useThemeColors();
  const { writingDirection } = useLocale();
  return { colors, styles: useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]) };
}

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { styles } = useStyles();
  const { isDesktop } = useResponsive();
  const clearance = useTabBarClearance();
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }, isDesktop && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.card}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
  /** Email/password: typed left-to-right in every language. */
  ltr?: boolean;
  /** Adds a show/hide toggle and hides the text by default. */
  password?: boolean;
};

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { label, hint, ltr = false, password = false, ...inputProps },
  ref
) {
  const { styles, colors } = useStyles();
  const { t, writingDirection } = useLocale();
  const [hidden, setHidden] = useState(password);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          {...inputProps}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { writingDirection: ltr ? "ltr" : writingDirection }]}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? "auth.showPassword" : "auth.hidePassword")}
          >
            <MaterialCommunityIcons name={hidden ? "eye-outline" : "eye-off-outline"} size={19} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

export function AuthError({ message }: { message: string | null }) {
  const { styles, colors } = useStyles();
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthSubmit({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const { styles, colors } = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.submit, (pressed || busy) && styles.submitPressed]}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.submitText}>{label}</Text>
      )}
    </Pressable>
  );
}

/** "Don't have an account? Register" line under the form. */
export function AuthSwitch({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  const { styles } = useStyles();
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchPrompt}>{prompt}</Text>
      <Pressable onPress={onPress} accessibilityRole="link">
        <Text style={styles.switchAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const text = { textAlign: "right" as const, writingDirection };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    // The bottom padding clears the floating tab bar on phone-width screens.
    content: { padding: spacing.md },
    contentDesktop: { width: "100%", maxWidth: 460, marginHorizontal: "auto", paddingTop: spacing.xl },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, ...text },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
      ...text,
    },
    card: {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    field: { gap: 6 },
    label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text, ...text },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
    },
    input: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.text,
      textAlign: "right",
    },
    // In the right-to-left row this sits at the left end of the field.
    eye: { paddingHorizontal: spacing.md, height: 44, alignItems: "center", justifyContent: "center" },
    hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, ...text },
    error: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.dangerTint,
    },
    errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, ...text },
    submit: {
      minHeight: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xs,
    },
    submitPressed: { opacity: 0.8 },
    submitText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    switchRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.xs },
    switchPrompt: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, writingDirection },
    switchAction: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary, writingDirection },
  });
}

/** Translated message for an error thrown by services/account.ts. */
export function accountErrorMessage(t: (key: string) => string, error: unknown): string {
  const code = error instanceof AccountError ? error.code : "unknown";
  return t(`auth.error.${code}`).replace("{min}", String(MIN_PASSWORD_LENGTH));
}
