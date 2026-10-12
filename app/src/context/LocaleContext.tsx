import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Alert, DevSettings, I18nManager, Platform } from "react-native";
import { Locale } from "@/types/site";
import { t as translate, isRTL } from "@/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  isRTL: boolean;
};

// Hebrew is the app's primary audience and the language most people should
// land on, regardless of the device/browser's own locale setting — English
// is a switch someone makes deliberately from Settings, not something the
// app should guess into from OS language.
const defaultLocale: Locale = "he";

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const rtl = isRTL(locale);

  // I18nManager needs to reflect the CURRENT locale from the very first
  // render, not just after someone visits Settings and flips the toggle —
  // otherwise every RTL-aware library internal (Paper's own mirroring,
  // React Navigation, etc.) starts up assuming LTR even though the app is
  // showing Hebrew by default, and only catches up once the user manually
  // changes the language once. This runs once on mount to close that gap;
  // `setLocale` below still owns the sync (and native reload) for later
  // in-session language changes.
  useEffect(() => {
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);

    if (I18nManager.isRTL === isRTL(next)) return;

    I18nManager.allowRTL(isRTL(next));
    I18nManager.forceRTL(isRTL(next));

    if (Platform.OS === "web") return; // handled by the effect below via the DOM `dir` attribute

    // Native (iOS/Android): Yoga only mirrors the whole layout tree — every
    // plain `flexDirection: "row"`, not just components written with
    // logical start/end props — once the JS bundle reloads and views remount
    // with the new I18nManager.isRTL value. There's no way around a reload;
    // in dev we can trigger it ourselves, in a production build without
    // expo-updates installed we can only tell the person to restart.
    if (__DEV__) {
      DevSettings.reload();
    } else {
      Alert.alert(
        translate(next, "settings.restartRequiredTitle"),
        translate(next, "settings.restartRequiredMessage")
      );
    }
  }, []);

  // Web: react-native-web maps RN's `flexDirection: "row"` etc. onto real CSS
  // flexbox, which the CSS spec itself mirrors under `direction: rtl` — but
  // only for the DOM subtree that's actually marked rtl. Nothing was setting
  // that anywhere (the previous comment here claimed this file did it, but
  // it didn't), so toggling the language never changed layout direction on
  // web, only text content. Setting `dir` on <html> is also what makes
  // browser-native behavior (bidi punctuation, scrollbar side, form control
  // alignment) and non-RN DOM (the Leaflet popups in Map.web.tsx) follow suit.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale, rtl]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (path: string) => translate(locale, path),
      isRTL: rtl,
    }),
    [locale, setLocale, rtl]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
