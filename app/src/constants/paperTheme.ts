import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from "react-native-paper";
import { lightColors, darkColors, fonts, type ColorTokens } from "./theme";

// Paper doesn't publicly export its MD3Type (a single typescale entry), so
// it's derived from a known-full variant on MD3Theme["fonts"] instead of the
// indexed union across all keys — that union also includes the "default"
// entry, which omits fontSize/lineHeight and made the spread below fail to
// typecheck against the fifteen real variants.
type MD3Type = MD3Theme["fonts"]["displayLarge"];

/**
 * Maps our color tokens onto React Native Paper's Material Design 3 theme
 * shape, so Paper components (Card, Chip, Appbar, SegmentedButtons, ...)
 * match the rest of the app instead of defaulting to Paper's stock purple —
 * and routes Paper's type scale through Rubik/Heebo so the same bold
 * display + clean body pairing shows up in every Paper-rendered heading and
 * label without hand-theming each screen individually.
 */
function withDisplayType(base: MD3Theme["fonts"]): MD3Theme["fonts"] {
  const family = (variant: MD3Type, fontFamily: string): MD3Type => ({
    ...variant,
    fontFamily,
  });
  return {
    ...base,
    displayLarge: family(base.displayLarge, fonts.display),
    displayMedium: family(base.displayMedium, fonts.display),
    displaySmall: family(base.displaySmall, fonts.display),
    headlineLarge: family(base.headlineLarge, fonts.display),
    headlineMedium: family(base.headlineMedium, fonts.display),
    headlineSmall: family(base.headlineSmall, fonts.displayBold),
    titleLarge: family(base.titleLarge, fonts.displayBold),
    titleMedium: family(base.titleMedium, fonts.displayMedium),
    titleSmall: family(base.titleSmall, fonts.displayMedium),
    bodyLarge: family(base.bodyLarge, fonts.body),
    bodyMedium: family(base.bodyMedium, fonts.body),
    bodySmall: family(base.bodySmall, fonts.body),
    labelLarge: family(base.labelLarge, fonts.bodyMedium),
    labelMedium: family(base.labelMedium, fonts.bodyMedium),
    labelSmall: family(base.labelSmall, fonts.bodyMedium),
  };
}

function buildTheme(base: MD3Theme, tokens: ColorTokens): MD3Theme {
  return {
    ...base,
    fonts: withDisplayType(base.fonts),
    colors: {
      ...base.colors,
      primary: tokens.primary,
      onPrimary: tokens.onPrimary,
      primaryContainer: tokens.primaryTint,
      onPrimaryContainer: tokens.primary,
      secondary: tokens.accent,
      onSecondary: tokens.onAccent,
      secondaryContainer: tokens.accentTint,
      onSecondaryContainer: tokens.accentDeep,
      background: tokens.background,
      onBackground: tokens.text,
      surface: tokens.surface,
      onSurface: tokens.text,
      surfaceVariant: tokens.surfaceAlt,
      onSurfaceVariant: tokens.textMuted,
      outline: tokens.border,
      outlineVariant: tokens.border,
      error: tokens.danger,
      onError: "#FFFFFF",
    },
  };
}

export const lightPaperTheme = buildTheme(MD3LightTheme, lightColors);
export const darkPaperTheme = buildTheme(MD3DarkTheme, darkColors);

export function getPaperTheme(scheme: "light" | "dark"): MD3Theme {
  return scheme === "dark" ? darkPaperTheme : lightPaperTheme;
}

/** @deprecated static light-mode fallback — prefer `getPaperTheme(scheme)`. */
export const paperTheme = lightPaperTheme;
