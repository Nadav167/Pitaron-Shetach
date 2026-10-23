/**
 * tiuliPage.js — fetches and parses one tiuli.com camping page
 * (https://www.tiuli.com/camping/<id>). Shared by importTiuliCampsites.js
 * (adds sites the dataset lacks) and enrichFromTiuli.js (fills the blanks
 * in sites it already has).
 *
 * What a page carries, when the site owner or tiuli filled it in:
 *   - a Waze link with the coordinates (`ll=lat,lng`);
 *   - an access note next to the region: "גישה לכל רכב" / "גישה ברכב 4X4";
 *   - "מתקנים:", a row of feature links (`/camping?features=<n>`), each an
 *     icon plus a label: "ברז מים", "שירותים", "מקלחות", "חיבור לחשמל",
 *     "בתשלום" / "ללא תשלום", ...;
 *   - a one-paragraph summary, then an article ("כל המידע על ...");
 *   - info boxes under orange headings: "שעות פתיחה", "מחירים", "איך מגיעים";
 *   - a phone (`tel:` link) and a photo (og:image).
 * Many free night camps have only the name, the region and the Waze link.
 */

// tiuli blocks the default fetch user agent.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DEFAULT_IMAGE = /default_share_image/;

const decode = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** HTML → text, keeping paragraph and list-item breaks as newlines. */
function toText(html) {
  return html
    .replace(/\s+/g, " ") // the source's own line wraps are not breaks
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div class="[^"]*gpt-banner[\s\S]*?<\/div>/g, "")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/ul)\b[^>]*>/g, "\n")
    .replace(/<li\b[^>]*>/g, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map(decode)
    .filter(Boolean)
    .join("\n");
}

/** Info boxes: an orange heading followed by a `ugc` block of text. */
function sections(html) {
  const found = {};
  const re = /text-orange-600 block[^>]*>([^<]+)<\/span>[\s\S]*?<div class="ugc[^"]*">([\s\S]*?)<\/div>/g;
  for (let match = re.exec(html); match; match = re.exec(html)) {
    found[decode(match[1])] = decode(match[2].replace(/<br\s*\/?>|<\/p>/g, " ").replace(/<[^>]+>/g, " "));
  }
  return found;
}

function parsePage(id, url, html) {
  const ll = /ll=(-?[0-9.]+)(?:,|%2C)(-?[0-9.]+)/.exec(html);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const image = (/og:image" content="([^"]*)/.exec(html) || [])[1] || null;
  const phone = (/href="tel:([^"]+)"/.exec(html) || [])[1] || null;
  const info = sections(html);
  const about = Object.entries(info).find(([heading]) => /^(על |אודות|תיאור)/.test(heading));

  const featuresBlock = (/מתקנים:<\/span>([\s\S]*?)<\/section>/.exec(html) || [])[1] || "";
  const features = [...featuresBlock.matchAll(/<span class="mr-1">([^<]+)<\/span>/g)].map((m) => decode(m[1]));
  const access = (/<span class="mx-2">\|<\/span><span>([^<]+)<\/span>/.exec(html) || [])[1];
  const summary = (/<section class="text-grey-900 text-lg lg:text-2xl[^"]*">([\s\S]*?)<\/section>/.exec(html) || [])[1];
  const article = (/<section class="article-body[^"]*">([\s\S]*?)<\/section>/.exec(html) || [])[1];

  return {
    id,
    url,
    name: decode((h1 ? h1[1] : "").replace(/<[^>]+>/g, " ")),
    lat: ll ? Number(ll[1]) : null,
    lng: ll ? Number(ll[2]) : null,
    image: image && !DEFAULT_IMAGE.test(image) ? image : null,
    hours: info["שעות פתיחה"] || "",
    prices: info["מחירים"] || "",
    address: (/כתובת:\s*([^]+)/.exec(info["איך מגיעים"] || "") || [])[1]?.trim() || "",
    directions: info["איך מגיעים"] || "",
    description: about ? about[1] : "",
    features,
    access: access ? decode(access) : "",
    summary: summary ? decode(summary.replace(/<[^>]+>/g, " ")) : "",
    article: article ? toText(article) : "",
    phone,
    closed: /החניון אינו פעיל|העסק אינו פעיל|סגור עד להודעה חדשה/.test(html),
  };
}

/**
 * Crawls ids 1..maxId with a few gentle workers. 404 = no such page.
 * Pages are slow (often 5-20 s) and occasionally time out, hence the
 * long timeout and the retries.
 */
async function crawl(maxId, { workers = 3, onPage } = {}) {
  const pages = [];
  const queue = Array.from({ length: maxId }, (_, i) => i + 1);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`https://www.tiuli.com/camping/${id}`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(60_000),
          });
          if (response.status === 404) break;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const page = parsePage(id, response.url, await response.text());
          pages.push(page);
          onPage?.(page);
          break;
        } catch (error) {
          if (attempt === 2) console.warn(`  page ${id}: ${error.message}`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      await new Promise((r) => setTimeout(r, 300)); // be gentle
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  return pages.sort((a, b) => a.id - b.id);
}

module.exports = { USER_AGENT, decode, parsePage, crawl };
