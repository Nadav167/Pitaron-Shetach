import { daysLabel, formatDate, pdfFileName, planLabels } from "@/lib/itinerary";
import { fonts, lightColors as palette } from "@/constants/theme";
import type { Itinerary } from "@/types/itinerary";
import { drawRouteMap, type RouteMap } from "@/lib/routeMap";

/**
 * "Download PDF" (web): builds an A4 PDF of the itinerary in the browser and
 * downloads it, with no PDF library.
 *
 * WHY IT IS BUILT THIS WAY
 * PDF libraries (pdf-lib, jsPDF...) place glyphs one by one and know nothing
 * of right-to-left text: Hebrew comes out reversed or broken unless you
 * embed a font and reorder every line yourself, which breaks again on mixed
 * Hebrew/English/numbers. The browser's canvas already implements the
 * Unicode bidi algorithm and real font shaping. So:
 *   1. each page is drawn on a <canvas> (2x A4 resolution) with fillText,
 *      with our own line wrapping and page breaking;
 *   2. each canvas is encoded as JPEG;
 *   3. a minimal PDF is written by hand: one page per JPEG, the JPEG bytes
 *      embedded as-is (/DCTDecode). That format is ~40 lines below.
 * The trade-off: text in this PDF is an image (not selectable/searchable).
 * "Print" (itineraryPrint.ts) is the selectable-text alternative.
 *
 * The first page carries a map of the trip with each day's route
 * (routeMap.ts) whenever the plan has coordinates; the days then start on
 * page 2.
 */

// A4 is 595.28 x 841.89 pt; pages are drawn at 2x for print sharpness.
const PT_W = 595.28;
const PT_H = 841.89;
const SCALE = 2;
const W = Math.round(PT_W * SCALE);
const H = Math.round(PT_H * SCALE);
const MARGIN = 80;
const FOOTER = 70;
const CONTENT_W = W - MARGIN * 2;
const TIME_COL = 120;
/** Height of the trip map on page 1 (its width is the content width). */
const MAP_H = 760;

type Font = { family: string; size: number };
const F = {
  brand: { family: fonts.displayBold, size: 22 },
  title: { family: fonts.display, size: 46 },
  body: { family: fonts.body, size: 23 },
  bodyBold: { family: fonts.bodyBold, size: 23 },
  small: { family: fonts.body, size: 19 },
  smallBold: { family: fonts.bodyMedium, size: 18 },
  dayTitle: { family: fonts.displayBold, size: 29 },
  section: { family: fonts.displayBold, size: 27 },
} satisfies Record<string, Font>;

const cssFont = (font: Font) => `${font.size}px "${font.family}", Arial, sans-serif`;

class PageWriter {
  pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  y = 0;

  constructor(private direction: "rtl" | "ltr") {
    this.newPage();
  }

  newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    // Both: `ctx.direction` where supported, the element's dir elsewhere
    // (the context's default direction is inherited from it).
    canvas.setAttribute("dir", this.direction);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    ctx.direction = this.direction;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
    this.ctx = ctx;
    this.pages.push(canvas);
    this.y = MARGIN;
  }

  /** Starts a new page unless `height` more pixels fit on this one. */
  ensure(height: number) {
    if (this.y + height > H - MARGIN - FOOTER) this.newPage();
  }

  /** Splits text into lines no wider than maxWidth. */
  wrap(text: string, font: Font, maxWidth: number): string[] {
    this.ctx.font = cssFont(font);
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.ctx.measureText(candidate).width <= maxWidth || !line) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** x of the line start for a given indent from the start edge. */
  private startX(indent: number) {
    return this.direction === "rtl" ? W - MARGIN - indent : MARGIN + indent;
  }

  /** Draws pre-wrapped lines at the current y and advances it. */
  lines(lines: string[], font: Font, color: string, lineHeight: number, indent = 0) {
    const ctx = this.ctx;
    ctx.font = cssFont(font);
    ctx.fillStyle = color;
    ctx.textAlign = this.direction === "rtl" ? "right" : "left";
    for (const line of lines) {
      ctx.fillText(line, this.startX(indent), this.y);
      this.y += lineHeight;
    }
  }

  /** Wraps and draws a paragraph, breaking pages between lines as needed. */
  paragraph(text: string, font: Font, color: string, lineHeight: number, indent = 0) {
    for (const line of this.wrap(text, font, CONTENT_W - indent)) {
      this.ensure(lineHeight);
      this.lines([line], font, color, lineHeight, indent);
    }
  }

  band(height: number, color: string) {
    this.ctx.fillStyle = color;
    // roundRect is missing before Safari 16 / Firefox 112.
    if (typeof this.ctx.roundRect !== "function") {
      this.ctx.fillRect(MARGIN, this.y, CONTENT_W, height);
      return;
    }
    this.ctx.beginPath();
    this.ctx.roundRect(MARGIN, this.y, CONTENT_W, height, 12);
    this.ctx.fill();
  }

  /** Draws a canvas (the trip map) full content width, with rounded corners. */
  image(source: HTMLCanvasElement, height: number) {
    const ctx = this.ctx;
    ctx.save();
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(MARGIN, this.y, CONTENT_W, height, 16);
      ctx.clip();
    }
    ctx.drawImage(source, MARGIN, this.y, CONTENT_W, height);
    ctx.restore();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN, this.y, CONTENT_W, height);
    this.y += height;
  }

  /** A coloured line swatch at the start edge, then text: a map legend row. */
  legendRow(color: string, text: string, font: Font, lineHeight: number) {
    const ctx = this.ctx;
    const swatchW = 44;
    const x = this.direction === "rtl" ? W - MARGIN - swatchW : MARGIN;
    ctx.fillStyle = color;
    ctx.fillRect(x, this.y + lineHeight / 2 - 4, swatchW, 8);
    this.lines(this.wrap(text, font, CONTENT_W - swatchW - 16), font, palette.text, lineHeight, swatchW + 16);
  }

  rule(color: string, width = 2) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(MARGIN, this.y, CONTENT_W, width);
  }

  /** Brand + page numbers + credit at the bottom of every page, once all exist. */
  footers(brand: string, credit: string) {
    this.pages.forEach((canvas, index) => {
      const ctx = canvas.getContext("2d")!;
      const y = H - MARGIN + 10;
      ctx.fillStyle = palette.border;
      ctx.fillRect(MARGIN, y - 18, CONTENT_W, 2);
      ctx.font = cssFont(F.small);
      ctx.fillStyle = palette.textFaint;
      ctx.textBaseline = "top";
      const start = this.direction === "rtl" ? W - MARGIN : MARGIN;
      const end = this.direction === "rtl" ? MARGIN : W - MARGIN;
      ctx.textAlign = this.direction === "rtl" ? "right" : "left";
      ctx.fillText(`${brand} · ${credit}`, start, y);
      // Always "1 / 3": in rtl the bidi algorithm would show it as "3 / 1".
      ctx.direction = "ltr";
      ctx.textAlign = this.direction === "rtl" ? "left" : "right";
      ctx.fillText(`${index + 1} / ${this.pages.length}`, end, y);
      ctx.direction = this.direction;
    });
  }
}

function drawItinerary(itinerary: Itinerary, routeMap: RouteMap | null): HTMLCanvasElement[] {
  const { plan } = itinerary;
  const { t, language, direction } = planLabels(itinerary);
  const page = new PageWriter(direction);
  const brand = language === "he" ? "פתרון שטח" : "Pitaron Shetach";

  // Header
  page.lines([brand], F.brand, palette.primary, 36);
  page.paragraph(itinerary.title, F.title, palette.text, 58);
  page.y += 6;
  page.paragraph(plan.summary, F.body, palette.textMuted, 34);
  page.y += 8;
  const meta = [
    daysLabel(itinerary, t),
    plan.startDate ? `${t("startDate")}: ${formatDate(plan.startDate, language)}` : null,
    plan.travelers ? `${t("travelers")}: ${plan.travelers}` : null,
  ].filter(Boolean);
  page.paragraph(meta.join("   ·   "), F.smallBold, palette.primary, 30);
  if (plan.preferences.length) {
    page.paragraph(`${t("preferences")}: ${plan.preferences.join(" · ")}`, F.small, palette.textMuted, 28);
  }
  page.y += 14;
  page.rule(palette.primary, 5);
  page.y += 26;

  // The trip map, its legend (day colour, title, driving distance) and a
  // note when some day's road route couldn't be fetched (dashed lines).
  if (routeMap) {
    page.lines([t("routeMap")], F.section, palette.primary, 42);
    page.y += 6;
    page.image(routeMap.canvas, MAP_H);
    page.y += 18;
    for (const day of routeMap.days) {
      const label = t("day").replace("{n}", String(day.dayNumber));
      const kmKey = day.profile === "foot" ? "walkingKm" : "drivingKm";
      const km = day.roadKm != null ? ` · ${t(kmKey).replace("{km}", String(day.roadKm))}` : "";
      page.legendRow(day.color, `${label} — ${day.title}${km}`, F.small, 30);
    }
    if (routeMap.days.some((day) => day.roadKm == null)) {
      page.y += 4;
      page.paragraph(t("straightLineNote"), F.small, palette.textMuted, 28);
    }
  }

  // Days: the first follows the header (or, with a map, starts page 2);
  // each later day starts a new page.
  for (const [index, day] of plan.days.entries()) {
    if (index > 0 || routeMap) page.newPage();
    const label = t("day").replace("{n}", String(day.dayNumber));
    const date = day.date ? ` · ${formatDate(day.date, language)}` : "";
    const heading = page.wrap(`${label}${date} — ${day.title}`, F.dayTitle, CONTENT_W - 40);
    const bandHeight = heading.length * 40 + 22;
    page.ensure(bandHeight + 120); // keep the heading with its first stop
    page.band(bandHeight, palette.primaryTint);
    page.y += 12;
    page.lines(heading, F.dayTitle, palette.primary, 40, 20);
    page.y += 14;
    if (day.campsiteName) {
      page.paragraph(`⛺ ${t("campsite")}: ${day.campsiteName}`, F.smallBold, palette.accentDeep, 30, 20);
      page.y += 4;
    }

    for (const item of day.items) {
      const bodyIndent = TIME_COL + 20;
      const bodyWidth = CONTENT_W - bodyIndent;
      const kind = page.wrap(t(`kind.${item.kind}`), F.smallBold, bodyWidth);
      const title = page.wrap(item.title, F.bodyBold, bodyWidth);
      const desc = item.description ? page.wrap(item.description, F.body, bodyWidth) : [];
      const placeText = [item.placeName, item.distanceKm != null ? t("fromCampsite").replace("{km}", String(item.distanceKm)) : null]
        .filter(Boolean)
        .join(" · ");
      const place = placeText ? page.wrap(placeText, F.small, bodyWidth) : [];
      const height = kind.length * 26 + title.length * 32 + desc.length * 32 + place.length * 28 + 28;

      page.ensure(Math.min(height, H / 2)); // keep a stop together unless huge
      const top = page.y;
      page.lines(page.wrap(item.time, F.bodyBold, TIME_COL), F.bodyBold, palette.primary, 32, 0);
      page.y = top;
      page.lines(kind, F.smallBold, palette.accentDeep, 26, bodyIndent);
      page.lines(title, F.bodyBold, palette.text, 32, bodyIndent);
      for (const line of desc) {
        page.ensure(32);
        page.lines([line], F.body, palette.text, 32, bodyIndent);
      }
      for (const line of place) {
        page.ensure(28);
        page.lines([line], F.small, palette.textMuted, 28, bodyIndent);
      }
      page.y += 12;
      page.rule(palette.border);
      page.y += 14;
    }
    page.y += 18;
  }

  // Packing list and tips
  for (const [title, entries] of [
    [t("packingList"), plan.packingList],
    [t("tips"), plan.tips],
  ] as const) {
    if (!entries.length) continue;
    page.ensure(120);
    page.lines([title], F.section, palette.primary, 42);
    for (const entry of entries) {
      const lines = page.wrap(entry, F.body, CONTENT_W - 34);
      page.ensure(lines.length * 32);
      const top = page.y;
      page.lines(["•"], F.bodyBold, palette.accentDeep, 32, 4);
      page.y = top;
      page.lines(lines, F.body, palette.text, 32, 34);
    }
    page.y += 22;
  }

  page.paragraph(t("disclaimer"), F.small, palette.textMuted, 28);
  page.footers(brand, t("osmCredit"));
  return page.pages;
}

// --- Minimal PDF writer: one JPEG per page -----------------------------------

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A PDF text string in UTF-16BE hex, so Hebrew titles survive in the metadata. */
function pdfTextString(value: string): string {
  let hex = "FEFF";
  for (let i = 0; i < value.length; i++) hex += value.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

function buildPdf(jpegs: Uint8Array[], title: string): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  // Objects: 1 catalog, 2 page tree, 3 info, then per page: page, contents, image.
  const pageIds = jpegs.map((_, i) => 4 + i * 3);
  push("%PDF-1.4\n%âãÏÓ\n");
  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${jpegs.length} >>\nendobj\n`);
  startObject(3);
  push(`<< /Title ${pdfTextString(title)} /Producer (Pitaron Shetach) >>\nendobj\n`);

  jpegs.forEach((jpeg, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const drawImage = `q ${PT_W} 0 0 ${PT_H} 0 0 cm /Im0 Do Q`;

    startObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    startObject(contentId);
    push(`<< /Length ${drawImage.length} >>\nstream\n${drawImage}\nendstream\nendobj\n`);
    startObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    push(jpeg);
    push("\nendstream\nendobj\n");
  });

  const count = 4 + jpegs.length * 3;
  const xrefOffset = length;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function downloadItineraryPdf(itinerary: Itinerary): Promise<void> {
  // The app's fonts are registered by expo-font; make sure the faces the
  // PDF uses are loaded before drawing, or the canvas falls back silently.
  if (document.fonts) {
    await Promise.all(Object.values(F).map((font) => document.fonts.load(cssFont(font), "אבג abc")));
  }
  // The map needs network (tiles, routes) but never fails the PDF: no map
  // is drawn rather than no PDF.
  const routeMap = await drawRouteMap(itinerary, CONTENT_W, MAP_H, {
    labelFont: cssFont({ family: fonts.bodyBold, size: 22 }),
    attributionFont: cssFont({ family: fonts.body, size: 17 }),
    background: palette.background,
  }).catch(() => null);
  const pages = drawItinerary(itinerary, routeMap);
  const jpegs = pages.map((canvas) => base64ToBytes(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]));
  const blob = buildPdf(jpegs, itinerary.title);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(itinerary);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
