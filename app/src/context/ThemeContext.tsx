import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import { lightColors, darkColors, type ColorTokens } from "@/constants/theme";
import { loadString, saveString } from "@/lib/storage";

const STORAGE_KEY = "theme";

export type ColorScheme = "light" | "dark";

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: ColorTokens;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Colors the scrollbar's track/thumb to match the app's current background
// so it blends in instead of showing as a bar down the side, while staying
// fully functional (still scrollable by wheel/trackpad/touch/keyboard —
// just camouflaged, not `display: none`, which some browsers treat as
// "reserve no space" and others don't, and which loses the "there's more
// below" affordance entirely).
//
// This used to live as static CSS in app/+html.tsx, which turned out to
// never run: Expo's web dev server only executes that custom HTML template
// when app.json's `web.output` is "static" or "server" (see
// useServerRendering in @expo/cli's MetroBundlerDevServer) — this project
// is configured with `output: "single"`, so the dev server was silently
// falling back to its generic SPA template the entire time, no matter how
// many times the dev server was restarted. Injecting the <style> tag here
// instead runs as plain client-side React code, the same way the `dir`/
// `lang` attributes are already set from LocaleContext — proven to work
// regardless of that config.
const SCROLLBAR_STYLE_ID = "campingil-scrollbar-style";
function injectScrollbarStyle() {
  if (document.getElementById(SCROLLBAR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = `
    html, body, #root, * {
      scrollbar-width: thin;
      scrollbar-color: var(--app-background, #F5F1E6) var(--app-background, #F5F1E6);
    }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track, ::-webkit-scrollbar-thumb {
      background: var(--app-background, #F5F1E6);
      border: none;
    }
  `;
  document.head.appendChild(style);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();

  // Starts from the last theme the user picked (saved on web, see
  // lib/storage), else the device's own light/dark setting. Only an explicit
  // choice is saved, so someone who never touches the toggle keeps following
  // their system setting.
  const [scheme, setSchemeState] = useState<ColorScheme>(() => {
    const saved = loadString(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return systemScheme === "dark" ? "dark" : "light";
  });

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    saveString(STORAGE_KEY, next);
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme(scheme === "dark" ? "light" : "dark");
  }, [scheme, setScheme]);

  const colors = scheme === "dark" ? darkColors : lightColors;

  // Inserts the scrollbar <style> tag once, then keeps the CSS variable it
  // references in sync with the current theme so the scrollbar recolors
  // immediately when Appearance is toggled, not just on first load.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    injectScrollbarStyle();
    document.documentElement.style.setProperty("--app-background", colors.background);
  }, [colors.background]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors,
      setScheme,
      toggleScheme,
    }),
    [scheme, colors, setScheme, toggleScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Convenience for components that only need the resolved color tokens. */
export function useThemeColors(): ColorTokens {
  return useTheme().colors;
}
