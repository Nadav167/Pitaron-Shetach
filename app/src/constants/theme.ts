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
  /** The floating bottom tab bar, and the icons/labels on it. */
  navBar: string;
  onNavBar: string;
  navBarActiveLabel: string;
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
  // Darkened from #B06B1E, which measured 4.2:1 on white at the 12-13px
  // sizes prices use; this is 6:1 (WCAG AA asks for 4.5).
  accentDeep: "#8F5412",
  accentTint: "#FBE8CE",
  text: "#17241D",
  textMuted: "#5B6B60",
  // Was #93A196, 2.4:1 on the cream background: too faint for the hints and
  // dates that use it. This passes 4.5:1.
  textFaint: "#617065",
  border: "#E3DFD0",
  danger: "#B3413B",
  dangerTint: "#F7E4D2",
  success: "#3E7A5D",
  onPrimary: "#FFFFFF",
  onAccent: "#241505",
  navBar: "#1F4D3A",
  onNavBar: "rgba(245,241,230,0.88)",
  navBarActiveLabel: "#FBE8CE",
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
  textFaint: "#7F9283",
  border: "rgba(243,238,225,0.12)",
  danger: "#E08B7D",
  dangerTint: "#3A2A17",
  success: "#78B594",
  onPrimary: "#0F1B16",
  onAccent: "#241505",
  // Not `primary`: night mode lightens primary to #5B9A78, and the cream
  // icons on it measured 2.9:1. A deep green keeps the bar dark at night.
  navBar: "#1F3A2D",
  onNavBar: "rgba(243,238,225,0.88)",
  navBarActiveLabel: "#F0BD82",
};

/** @deprecated static light-mode fallback — prefer `useThemeColors()`. */
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 16, lg: 22, pill: 999 };

/**
 * Smallest comfortable touch target: Apple asks for 44pt, Android for 48dp.
 * Icon buttons are at least this big; a smaller visual (a 34px circle) sits
 * centered inside a hit area of this size.
 */
export const TOUCH_TARGET = 44;

/**
 * The floating bottom tab bar on phone-width screens (see
 * app/(tabs)/_layout.tsx). Scrolling screens pad their content by
 * useTabBarClearance() so the last item scrolls clear of it.
 */
export const TAB_BAR = { height: 64, bottom: 18, side: 16 };

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
