# Handoff (2026-10-18): where the project stands

Read this before starting. Older detail is in `docs/ARCHITECTURE.md` and the claude.ai project docs.

## State of the repo
- `origin/main` = commit `1a80ea2` (Sep 15). Everything since is committed on the local branch `redesign-unified-data`, **not yet pushed or merged into `main`**.
- `npm run typecheck` (app + server) passes clean.
- Root `npm install` has been run, so server and scraper deps (express, supabase-js, cheerio, puppeteer) are installed.

## Done
- **Oct 12 work:** unified campsite model + 37-site dataset, redesign (theme, fonts, desktop nav), and RTL foundations.
- **Oct 12 tester feedback, all items:**
  - Rebrand to פתרון שטח.
  - Search: bar stays mounted; matching covers both languages, regions, typos and town radius.
  - Site detail: RTL back arrow, missing-info note, RTL source lines.
  - Map locked to Israel, with a mask over the area outside it.
  - Layout stays RTL in every language.
  - Settings tab replaced by header toggles; new About page.
  - Favorites gets the same filters.
- **Oct 18:**
  - Theme, language and favorites persist (`src/lib/storage.ts`, web localStorage).
  - Map tab uses the shared filters/search/sort; desktop has a results panel beside the map; the map zooms to the results while filtering.
  - RTL fixes: native map callouts and navigation-button icons.
  - Site page credits the coordinate source by name (`coordsSourceName`) instead of the raw internal note.
- **Browser-tested on web (desktop + 400px):**
  - Typing a full word, including a query with no results.
  - Matching for "דרום" and "ניצן".
  - Map desktop/mobile and zoom to results.
  - Persistence across reload.
  - Detail page source lines.

## Waiting on Nadav
1. **Fresh live test** of everything above, ideally on a real phone too. Native (iOS/Android) has not been run at all this round.
2. **Review the About page copy** (`app/(tabs)/about.tsx` + `about.*` in `he.json` / `en.json`). It was drafted, not approved.
3. ~~Native persistence~~ done: AsyncStorage added, hydrated at startup in `src/lib/storage.ts` (not yet tested on a device).
4. **Favorite control on the detail screen:** it's a labeled button ("הוספה לאתרים מועדפים"), not a heart in the app bar. The code comment says this was deliberate; confirm that's what you want.
5. **Supabase:** `server/` runs (`/api/health` OK), but `/api/sites` needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.
6. **Push / merge** `redesign-unified-data` into `main` when happy.

## Scraper: first live run (2026-10-18), not usable yet. DEFERRED by Nadav (too long for now)
`node scripts/scrapeCampsites.js --out=<tmp>`. The committed JSON was **not** touched. Results:
- **0/225 coordinates.** tiuli.com's search page renders its results client-side, so the static HTML only contains menu links (`/camping`, `/attractions`...) and no `ll=` coordinates. Fix: find tiuli's search API/XHR (or use puppeteer for that step). Until then, never run without `--merge`, or every pin is lost.
- **IDs changed:** unofficial sites come out as `gc-site-42` instead of the committed slugs (`gc-ein-zivan-night-campground`). Favorites are keyed by id, so the slugging must be fixed to keep the old ids before any scraped data replaces the JSON.
- **Scope jump:** gocamping now yields 213 listings (committed: 19); parks.org.il yields 12 (committed: 18). Many gocamping entries are closed or changed ("החניון אינו פעיל", "נסגר", "בקרוב"). Decide whether to expand the dataset, and filter closed sites if so.
- All 225 were flagged `needsReview` (they lack coordinates).

## Open items
1. Review the 8 `needsReview` sites in the committed data (esp. אכזיב, and the two Neot HaKikar khans).
2. Scraper fixes above (deferred; the committed 37-site JSON stays the data source).

## Rules
- Follow `CLAUDE.md` (ask before installing new npm deps).
- Never move the project back into OneDrive (it breaks Metro's file scanning).
- Never ship guessed coordinates; null is correct when unverified.
- RTL: react-native-paper's `<Text>` hardcodes `textAlign: 'left'`, `List.Item`/`Button` use physical LTR margins. Override them yourself; don't rely on Paper for RTL. A `direction` style is rejected by react-native-web; use the `dir` prop.
- Run the app with: `cd app && npx expo start --web -c`
