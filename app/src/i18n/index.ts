import he from "./he.json";
import en from "./en.json";
import { Locale } from "@/types/site";

const dictionaries = { he, en } satisfies Record<Locale, typeof he>;

type Dictionary = typeof he;

/**
 * Minimal, dependency-free i18n: two flat JSON dictionaries plus a
 * `t(locale, "a.b.c")` lookup. Good enough for a skeleton with two
 * languages; swap for i18next/react-i18next if the string count or the
 * number of locales grows.
 */
export function t(locale: Locale, path: string): string {
  const dict: Dictionary = dictionaries[locale] ?? dictionaries.he;
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

export const isRTL = (locale: Locale) => locale === "he";

export { dictionaries };
