import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager, Platform } from "react-native";
import { Locale } from "@/types/site";
import { t as translate } from "@/i18n";
import { loadString, saveString } from "@/lib/storage";

const STORAGE_KEY = "locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  /**
   * Reading direction of the current language's TEXT — for `writingDirection`
   * on a text style, so an English sentence reads left-to-right inside its
   * box. It says nothing about where the box sits: the layout itself never
   * changes with the language (see below).
   */
  writingDirection: "rtl" | "ltr";
};

// Hebrew is the app's primary audience and the language most people should
// land on, regardless of the device/browser's own locale setting — English
// is a switch someone makes deliberately, not something the app should guess
// into from OS language.
const defaultLocale: Locale = "he";

/**
 * LAYOUT DIRECTION IS FIXED, AND IT IS RIGHT-TO-LEFT.
 *
 * Switching language changes the words and nothing else: the language
 * button, the tabs, the back arrow, the favorite heart and every card stay
 * exactly where they are. The layout is always the Hebrew one. So direction
 * is set once, here, and is deliberately NOT derived from the locale — any
 * component that needs to position something writes the RTL position
 * directly instead of branching on the language.
 *
 * Native (iOS/Android): `forceRTL` only takes effect from the next app
 * launch, so on a device whose system language is left-to-right the very
 * first run after install is still LTR; every run after that is RTL.
 * `swapLeftAndRightInRTL(false)` keeps `left`/`right`/`paddingLeft`/... in
 * styles physical, the way they already are on web — without it React Native
 * silently swaps them under RTL, and the hand-mirrored styles in this app
 * (written and checked on web) would be flipped a second time.
 */
if (Platform.OS !== "web") {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  I18nManager.swapLeftAndRightInRTL(false);
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // The last language the user picked (saved on web, see lib/storage),
  // else Hebrew.
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = loadString(STORAGE_KEY);
    return saved === "he" || saved === "en" ? saved : defaultLocale;
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    saveString(STORAGE_KEY, next);
  }, []);

  // Web: react-native-web maps `flexDirection: "row"` onto real CSS flexbox,
  // which mirrors under `direction: rtl` for whatever DOM subtree is marked
  // rtl. `dir` on <html> is that mark, and it also brings along the browser's
  // own behavior (scrollbar side, form controls) and non-RN DOM such as the
  // Leaflet popups. It is always "rtl"; only `lang` follows the locale.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.dir = "rtl";
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (path: string) => translate(locale, path),
      writingDirection: locale === "he" ? "rtl" : "ltr",
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
