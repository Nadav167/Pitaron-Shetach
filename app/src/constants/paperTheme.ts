import { MD3LightTheme } from "react-native-paper";
import { colors } from "./theme";

/**
 * Maps our existing color tokens (constants/theme.ts) onto React Native
 * Paper's Material Design 3 theme shape, so Paper components (Card, Chip,
 * Appbar, SegmentedButtons, ...) match the rest of the app instead of
 * defaulting to Paper's stock purple.
 */
export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: "#FFFFFF",
    primaryContainer: colors.primaryLight,
    onPrimaryContainer: "#FFFFFF",
    secondary: colors.accent,
    onSecondary: "#FFFFFF",
    secondaryContainer: "#F3E1C8",
    onSecondaryContainer: "#4A340F",
    background: colors.background,
    onBackground: colors.text,
    surface: colors.surface,
    onSurface: colors.text,
    surfaceVariant: "#EDEAE1",
    onSurfaceVariant: colors.textMuted,
    outline: colors.border,
    outlineVariant: colors.border,
    error: colors.danger,
    onError: "#FFFFFF",
  },
};
