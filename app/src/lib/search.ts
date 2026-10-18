import type { Campsite } from "@/types/campsite";
import { dictionaries } from "@/i18n";
import { REGION_BUCKET } from "@/lib/sort";
import { CITIES, type City } from "@/data/cities";

/**
 * Free-text search over campsites.
 *
 * Someone typing into the search bar usually doesn't know a site's exact
 * name — they type an area ("דרום", "golan"), part of a name, or a word they
 * half remember. So every site is matched against one combined text: its
 * name, region, address and description in BOTH languages, plus the
 * north / center / south bucket its region falls into (the same buckets the
 * region sort uses).
 *
 * Matching runs in two passes:
 *   1. exact  — every word of the query appears somewhere in that text.
 *   2. fuzzy  — only if pass 1 found nothing: a word may also be one typo
 *               away from a word in the text.
 * Keeping fuzzy as a fallback means a correctly spelled query never returns
 * sites that don't actually contain it.
 *
 * Town names are handled separately by `findCityInQuery`: a campsite's own
 * text rarely mentions the nearest town, so "חיפה" is answered by distance
 * (see useSiteFilters), not by this text match alone.
 */

const BUCKET_WORDS: Record<number, string> = {
  0: "צפון north northern",
  1: "מרכז center centre central",
  2: "דרום south southern",
};

const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * Lowercases, drops niqqud/cantillation and quote marks (so "Ma'ayan" and
 * "maayan" agree), folds Hebrew final letters into their regular form, and
 * turns every other run of punctuation into a single space.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/['’‘`׳״"]/g, "")
    .replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter])
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const haystackCache = new WeakMap<Campsite, { text: string; words: string[] }>();

function haystackFor(campsite: Campsite) {
  const cached = haystackCache.get(campsite);
  if (cached) return cached;

  const text = normalizeSearchText(
    [
      campsite.name.he,
      campsite.name.en,
      dictionaries.he.region[campsite.region],
      dictionaries.en.region[campsite.region],
      BUCKET_WORDS[REGION_BUCKET[campsite.region]],
      campsite.address,
      campsite.description?.he,
      campsite.description?.en,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const entry = { text, words: text.split(" ") };
  haystackCache.set(campsite, entry);
  return entry;
}

/** True when `a` and `b` differ by at most `max` single-character edits. */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

/**
 * Hebrew attaches "in/the/to/from" to the front of a word ("בדרום", "הגולן"),
 * so a token is also tried without a one-letter prefix.
 */
function tokenVariants(token: string): string[] {
  return token.length >= 4 && /^[הבלמ]/.test(token) ? [token, token.slice(1)] : [token];
}

function tokenMatches(token: string, haystack: { text: string; words: string[] }, fuzzy: boolean): boolean {
  return tokenVariants(token).some((variant) => {
    if (haystack.text.includes(variant)) return true;
    // Short words are too easy to hit by accident to allow a typo in.
    if (!fuzzy || variant.length < 4) return false;
    const allowed = variant.length >= 7 ? 2 : 1;
    return haystack.words.some(
      (word) =>
        withinEditDistance(variant, word, allowed) ||
        // Also compare against the start of longer words, so a typo in a
        // half-typed word still finds it.
        (word.length > variant.length && withinEditDistance(variant, word.slice(0, variant.length), allowed))
    );
  });
}

const cityAliases: { city: City; words: string[] }[] = CITIES.flatMap((city) =>
  [city.name.he, city.name.en, ...(city.aliases ?? [])].map((alias) => ({
    city,
    words: normalizeSearchText(alias).split(" "),
  }))
);

/**
 * Finds a known town named anywhere in the query ("חיפה", "קמפינג ליד
 * טבריה", "near Eilat"). Only whole words count, so a half-typed name is
 * still an ordinary text search; the first word may carry a Hebrew
 * one-letter prefix ("בחיפה"). When several towns match, the longest name
 * wins, so "קריית שמונה" is not mistaken for something shorter.
 */
export function findCityInQuery(query: string): City | null {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  let best: { city: City; length: number } | null = null;

  for (const { city, words } of cityAliases) {
    const length = words.join("").length;
    if (best && length <= best.length) continue;
    for (let start = 0; start + words.length <= tokens.length; start++) {
      const matches = words.every((word, i) =>
        i === 0 ? tokenVariants(tokens[start]).includes(word) : tokens[start + i] === word
      );
      if (matches) {
        best = { city, length };
        break;
      }
    }
  }
  return best?.city ?? null;
}

/**
 * Returns a new array in the original order — never mutates the input.
 * `fuzzy: false` skips the typo-tolerant fallback pass.
 */
export function searchCampsites(list: Campsite[], query: string, options: { fuzzy?: boolean } = {}): Campsite[] {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return list;

  const run = (fuzzy: boolean) =>
    list.filter((campsite) => {
      const haystack = haystackFor(campsite);
      return tokens.every((token) => tokenMatches(token, haystack, fuzzy));
    });

  const exact = run(false);
  return exact.length > 0 || options.fuzzy === false ? exact : run(true);
}
