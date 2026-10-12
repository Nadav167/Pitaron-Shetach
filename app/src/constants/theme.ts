/**
 * Central design tokens for the app.
 *
 * Colors come in light/dark PAIRS — read them through `useThemeColors()`
 * (src/context/ThemeContext.tsx) inside a component, never import
 * `lightColors`/`darkColors` directly, or the value won't update when the
 * person switches Appearance in Settings. `colors` below is kept only as a
 * static light-mode fallback for anything that genuinely can't use the hook
 * (module-level constants); prefer the hook everywhere else.
 */
export type ColorTokens = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryLight: string;
  primaryTint: string;
  accent: string;
  accentDeep: string;
  accentTint: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  danger: string;
  dangerTint: string;
  success: string;
  onPrimary: string;
  onAccent: string;
};

export const lightColors: ColorTokens = {
  background: "#F5F1E6",
  backgroundElevated: "#FBF8EF",
  surface: "#FFFFFF",
  surfaceAlt: "#FBF8EF",
  primary: "#1F4D3A",
  primaryLight: "#3E7A5D",
  primaryTint: "#E3EEE7",
  accent: "#D98E3B",
  accentDeep: "#B06B1E",
  accentTint: "#FBE8CE",
  text: "#17241D",
  textMuted: "#5B6B60",
  textFaint: "#93A196",
  border: "#E3DFD0",
  danger: "#B3413B",
  dangerTint: "#F7E4D2",
  success: "#3E7A5D",
  onPrimary: "#FFFFFF",
  onAccent: "#241505",
};

export const darkColors: ColorTokens = {
  background: "#0F1B16",
  backgroundElevated: "#16241D",
  surface: "#16241D",
  surfaceAlt: "#1C2C23",
  primary: "#5B9A78",
  primaryLight: "#78B594",
  primaryTint: "#20362B",
  accent: "#E7A85B",
  accentDeep: "#F0BD82",
  accentTint: "#3A2A17",
  text: "#F3EEE1",
  textMuted: "#B6C5BA",
  textFaint: "#728576",
  border: "rgba(243,238,225,0.12)",
  danger: "#E08B7D",
  dangerTint: "#3A2A17",
  success: "#78B594",
  onPrimary: "#0F1B16",
  onAccent: "#241505",
};

/** @deprecated static light-mode fallback — prefer `useThemeColors()`. */
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 16, lg: 22, pill: 999 };

/**
 * Rubik (display) + Heebo (body) — bold headline type with a genuine Hebrew
 * counterpart (not a Latin display font silently falling back to system on
 * Hebrew text), paired with a clean, highly legible body face. Both load via
 * @expo-google-fonts, wired up in app/_layout.tsx.
 */
export const fonts = {
  display: "Rubik_900Black",
  displayBold: "Rubik_700Bold",
  displayMedium: "Rubik_500Medium",
  body: "Heebo_400Regular",
  bodyMedium: "Heebo_500Medium",
  bodyBold: "Heebo_700Bold",
};

export const typography = {
  title: { fontSize: 22, fontFamily: fonts.display },
  subtitle: { fontSize: 16, fontFamily: fonts.displayMedium },
  body: { fontSize: 14, fontFamily: fonts.body },
  caption: { fontSize: 12, fontFamily: fonts.body },
};
