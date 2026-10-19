import { daysLabel, formatDate, planLabels } from "@/lib/itinerary";
import type { Itinerary } from "@/types/itinerary";

/**
 * "Print" (web): opens the itinerary as a standalone, print-styled page in
 * a new tab and calls the browser's print dialog, where the user prints it
 * or picks "Save as PDF". The browser lays the text out itself, so Hebrew,
 * mixed Hebrew/English and numbers come out exactly right, and the text in
 * the PDF stays selectable. (Download PDF, in itineraryPdf.ts, makes a file
 * in one click but as page images.)
 *
 * Must be called straight from a click handler, or popup blockers stop the
 * new tab.
 */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildItineraryHtml(itinerary: Itinerary): string {
  const { plan } = itinerary;
  const { t, language, direction } = planLabels(itinerary);
  const appName = language === "he" ? "פתרון שטח" : "Pitaron Shetach";

  const meta = [
    daysLabel(itinerary, t),
    plan.startDate ? `${t("startDate")}: ${formatDate(plan.startDate, language)}` : null,
    plan.travelers ? `${t("travelers")}: ${plan.travelers}` : null,
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeHtml(item!)}</span>`)
    .join("");

  const days = plan.days
    .map((day) => {
      const items = day.items
        .map((item) => {
          const place = [item.placeName, item.distanceKm != null ? t("fromCampsite").replace("{km}", String(item.distanceKm)) : null]
            .filter(Boolean)
            .join(" · ");
          return `<li class="item">
            <div class="time">${escapeHtml(item.time)}</div>
            <div class="body">
              <div class="item-title"><span class="kind">${escapeHtml(t(`kind.${item.kind}`))}</span>${escapeHtml(item.title)}</div>
              ${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ""}
              ${place ? `<div class="place">${escapeHtml(place)}</div>` : ""}
            </div>
          </li>`;
        })
        .join("");
      const date = day.date ? ` · ${escapeHtml(formatDate(day.date, language))}` : "";
      return `<section class="day">
        <h2><span class="day-num">${escapeHtml(t("day").replace("{n}", String(day.dayNumber)))}${date}</span>${escapeHtml(day.title)}</h2>
        ${day.campsiteName ? `<div class="camp">⛺ ${escapeHtml(t("campsite"))}: ${escapeHtml(day.campsiteName)}</div>` : ""}
        <ol class="items">${items}</ol>
      </section>`;
    })
    .join("");

  const list = (title: string, entries: string[]) =>
    entries.length
      ? `<section class="list"><h3>${escapeHtml(title)}</h3><ul>${entries.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></section>`
      : "";

  return `<!doctype html>
<html lang="${language}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(itinerary.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Rubik:wght@700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Heebo, Arial, sans-serif; color: #17241D; background: #fff; font-size: 11pt; line-height: 1.5; }
  .page { max-width: 800px; margin: 0 auto; padding: 24px; }
  header { border-bottom: 3px solid #1F4D3A; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-family: Rubik, Heebo, sans-serif; font-weight: 700; color: #1F4D3A; font-size: 10pt; letter-spacing: .02em; }
  h1 { font-family: Rubik, Heebo, sans-serif; font-weight: 900; font-size: 22pt; margin: 4px 0 6px; line-height: 1.2; }
  .summary { color: #5B6B60; margin: 0 0 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 9.5pt; color: #1F4D3A; font-weight: 500; }
  .prefs { margin-top: 6px; font-size: 9.5pt; color: #5B6B60; }
  .day { break-inside: auto; margin: 18px 0 8px; }
  /* Each day after the first starts on a new printed page. */
  @media print { .day + .day { break-before: page; margin-top: 0; } }
  h2 { font-family: Rubik, Heebo, sans-serif; font-weight: 700; font-size: 14pt; margin: 0 0 4px; padding: 6px 10px; background: #E3EEE7; border-radius: 6px; break-after: avoid; }
  .day-num { color: #1F4D3A; margin-inline-end: 10px; }
  .camp { font-size: 10pt; color: #B06B1E; font-weight: 500; margin: 4px 10px 6px; }
  .items { list-style: none; margin: 0; padding: 0; }
  .item { display: flex; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #E3DFD0; break-inside: avoid; }
  .time { flex: 0 0 64px; font-weight: 700; color: #1F4D3A; }
  .body { flex: 1; }
  .item-title { font-weight: 700; }
  .kind { display: inline-block; font-size: 8pt; font-weight: 500; color: #B06B1E; background: #FBE8CE; border-radius: 4px; padding: 0 5px; margin-inline-end: 6px; vertical-align: 1px; }
  .desc { color: #17241D; }
  .place { color: #5B6B60; font-size: 9.5pt; }
  .list { margin-top: 18px; break-inside: avoid; }
  h3 { font-family: Rubik, Heebo, sans-serif; font-weight: 700; font-size: 13pt; margin: 0 0 4px; color: #1F4D3A; }
  .list ul { margin: 0; padding-inline-start: 20px; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #E3DFD0; font-size: 8.5pt; color: #93A196; }
  @media print { .page { padding: 0; max-width: none; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">${appName}</div>
    <h1>${escapeHtml(itinerary.title)}</h1>
    <p class="summary">${escapeHtml(plan.summary)}</p>
    <div class="meta">${meta}</div>
    ${plan.preferences.length ? `<div class="prefs">${escapeHtml(t("preferences"))}: ${escapeHtml(plan.preferences.join(" · "))}</div>` : ""}
  </header>
  ${days}
  ${list(t("packingList"), plan.packingList)}
  ${list(t("tips"), plan.tips)}
  <footer>${escapeHtml(t("disclaimer"))}<br>${escapeHtml(t("osmCredit"))}</footer>
</div>
<script>
  // Print once the web fonts are in, or Hebrew prints in a fallback font.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    setTimeout(function () { window.print(); }, 150);
  });
</script>
</body>
</html>`;
}

/** Returns false if the browser blocked the new tab. */
export function printItinerary(itinerary: Itinerary): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildItineraryHtml(itinerary));
  win.document.close();
  return true;
}
