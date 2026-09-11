/**
 * Central design tokens for the app. Keep this as the single source of
 * truth for colors/spacing so screens don't hardcode hex values.
 */
export const colors = {
  background: "#F7F5F0",
  surface: "#FFFFFF",
  primary: "#1F4D3A", // deep forest green
  primaryLight: "#3E7A5D",
  accent: "#D98E3B", // campfire orange
  text: "#1C1C1C",
  textMuted: "#6B6B6B",
  border: "#E3E0D8",
  danger: "#B3413B",
  success: "#3E7A5D",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: "700" as const },
  subtitle: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};
