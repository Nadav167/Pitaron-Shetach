import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import { Locale } from "@/types/site";
import { t as translate, isRTL } from "@/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  isRTL: boolean;
};

const defaultLocale: Locale =
  Localization.getLocales()[0]?.languageCode === "en" ? "en" : "he";

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // NOTE: react-native's I18nManager.forceRTL requires a reload to fully
    // take effect on native. On web, direction is applied via the `dir`
    // attribute in app/_layout.tsx instead. This is a skeleton-level wiring
    // point — a production build should persist the choice and prompt for
    // reload on native platforms.
    if (I18nManager.isRTL !== isRTL(next)) {
      I18nManager.allowRTL(isRTL(next));
      I18nManager.forceRTL(isRTL(next));
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (path: string) => translate(locale, path),
      isRTL: isRTL(locale),
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
