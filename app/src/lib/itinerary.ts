import { t as translate } from "@/i18n";
import type { Itinerary, ItineraryItemKind } from "@/types/itinerary";

/**
 * Helpers shared by the itinerary page, its print view and the PDF.
 *
 * An itinerary is written in one language (`plan.language`, whatever the
 * user chatted in), so its labels ("Day 1", "Packing list") follow the plan,
 * not the interface language: a Hebrew plan stays all-Hebrew even when it's
 * opened with the English UI.
 */

export function planLabels(itinerary: Itinerary) {
  const language: "he" | "en" = itinerary.plan.language === "en" ? "en" : "he";
  return {
    language,
    direction: language === "he" ? ("rtl" as const) : ("ltr" as const),
    t: (key: string) => translate(language, `itineraries.${key}`),
  };
}

export const KIND_ICONS: Record<ItineraryItemKind, string> = {
  drive: "car",
  hike: "hiking",
  activity: "flag-outline",
  meal: "silverware-fork-knife",
  camp: "tent",
  shopping: "cart-outline",
  other: "map-marker-outline",
};

/** "3 days" / "יום אחד". */
export function daysLabel(itinerary: Itinerary, t: (key: string) => string): string {
  const count = itinerary.plan.days.length;
  return count === 1 ? t("oneDay") : t("days").replace("{n}", String(count));
}

/** An ISO date or timestamp as a short local date ("18.10.2026" / "Oct 18, 2026"). */
export function formatDate(iso: string, language: "he" | "en"): string {
  // Plain dates (YYYY-MM-DD) are read as local, not UTC, so they don't shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: language === "he" ? "numeric" : "short",
    year: "numeric",
  });
}

/** File name for the PDF: the title, minus characters file systems reject. */
export function pdfFileName(itinerary: Itinerary): string {
  const safe = itinerary.title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${safe || "itinerary"}.pdf`;
}
