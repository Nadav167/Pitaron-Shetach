# Handoff (2026-10-19): where the project stands

Read this before starting. Older detail is in `docs/ARCHITECTURE.md` and the claude.ai project docs.

## State of the repo
- `main` is pushed and live (2026-10-18), including `user-accounts`. Repo: `github.com/Nadav167/Pitaron-Shetach`. Local folder is now `Documents\Pitaron-Shetach`.
- **Branch `travel-agent`** (2026-10-19, pushed, not merged into `main`): the travel agent, see below. Vercel Preview: https://pitaron-shetach-git-travel-agent-nadav18.vercel.app
- **Hosting:** Vercel project `pitaron-shetach` (root dir `app`, `npx expo export -p web`, output `dist`), auto-deploys `main`. Live at https://pitaron-shetach.vercel.app (old https://camping-il-server.vercel.app still works). `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are set for Production + Preview. `app/vercel.json` rewrites every path except `/api/*` to `index.html` (fixes 404 on refresh/deep links) and gives `api/**` functions 120 s. The old `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` vars were deleted 2026-10-18; `PORT` / `CORS_ORIGIN` remain (unused, harmless).
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

## User accounts (live since 2026-10-18)
- **Supabase project:** "Pitaron Shetach", ref `wmnxnxsyanbdyfbpccwb`, region **eu-central-1 (Frankfurt)**. Migration 0003 applied; "Confirm email" off. Keys in `app/.env` (git-ignored). The first project (`bcpufpubabpfrgptlsew`, Tokyo) has been deleted.
- **Verified against the real database** (scripted, 2026-10-18): register → instant session; profile row by trigger; add/remove/dedupe favorites; favorites survive log-out/log-in; wrong password → `invalid_credentials`; duplicate email → `user_already_exists`; RLS blocks reading or writing another user's profile/favorites (42501). Test users deleted afterwards.
- **GitHub repo** renamed to `Nadav167/Pitaron-Shetach` (local `origin` updated).
Register (first name, last name, email, password), log in, log out, with each user's favorites saved in the database.
- **Design:**
  - The app talks to Supabase directly: Supabase Auth for accounts, and the `profiles` + `favorites` tables from `supabase/migrations/0003_user_accounts_favorites.sql`.
  - Row Level Security keeps every user to their own rows. Email confirmation is off: registering logs you straight in.
- **Code:**
  - Business logic: `src/services/account.ts` and `src/services/favorites.ts`.
  - State: `src/context/AuthContext.tsx`, plus `FavoritesContext` (guest favorites stay on the device and are merged into the account on login).
  - Screens: `app/(tabs)/login.tsx` and `register.tsx`, built from `src/components/AuthForm.tsx`.
  - Header: `src/components/AccountButton.tsx`, to the right of the language button. Logged out it shows "התחברות"; logged in, "שלום, <first name>" with a menu that holds "התנתקות".
- **Phones:** when signed in, the phone header shows only the logo, not the brand name, so the welcome chip fits. Long names truncate under 360px.
- **Without keys:** if `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are unset, all account UI is hidden and the app works as before.
- **Tested in the browser with placeholder keys:**
  - Form layout and field-to-field Enter.
  - Validation and translated errors.
  - The network-error path.
  - Welcome chip and menu (via a planted fake session).
  - Logout clears the session even offline.
  - Header fits at 375px and 320px.
- **Not tested yet:** the register/login screens against the real backend in a browser (only the scripted test above), and native.
- **To go live:**
  1. Create the Supabase project.
  2. Run the 0003 SQL.
  3. Turn off "Confirm email".
  4. Put the URL + anon key in `app/.env`. Steps are in `supabase/README.md`.
  5. Then test register → favorite → log out → log in on another browser.
- **Deploying the website:** the keys are read at build time, so the live site's build needs the same two env vars.

## Travel agent (2026-10-19, branch `travel-agent`)
A chat "trip planner" (tab "מתכנן הטיולים"), for signed-in users only, plus a "המסלולים שלי" tab (only while signed in) and an itinerary page with PDF.
- **Decisions (Nadav):**
  - Model **Claude Haiku 5.5** (cost: ~$0.0005 per Q&A message, ~$0.01 per planned trip, measured).
  - Places from **OpenStreetMap** (free).
  - Chat for **logged-in users only**.
  - **Both PDF options.**
  - `@anthropic-ai/sdk` approved and installed in `app`.
- **What it does:**
  - Answers camping questions (general, in Israel, by region) and politely declines anything else.
  - Plans trips around the app's own campsites, using real places near them.
  - Saves each trip to the user's account through its `save_itinerary` tool.
- **Where things are:**
  - Route: `app/api/agent/chat.ts` (Vercel function).
  - HTTP layer: `app/backend/controllers/agentChat.ts`.
  - Agent loop: `app/backend/agent/runAgent.ts`.
  - Tools: `tools.ts`.
  - System prompt with the campsite index: `prompt.ts`.
  - Places lookup: `places.ts`.
  - DB access: `app/backend/supabase.ts`. It uses the anon key plus the caller's token, so RLS applies.
  - Shared types: `app/src/types/itinerary.ts`.
- **Screens:**
  - `app/(tabs)/agent.tsx`: the chat is kept per user on the device.
  - `app/(tabs)/itineraries.tsx`.
  - `app/itinerary/[id].tsx`.
- **PDF (web only):**
  - "הדפסה" (`src/lib/itineraryPrint.ts`) opens a print page; saving as PDF from the print dialog keeps the text selectable.
  - In both, each day after the first starts on a new page (requested 2026-10-19).
  - "הורדת PDF" (`src/lib/itineraryPdf.ts`) draws the pages on a canvas and packs them into a small hand-written PDF writer. No library: canvas handles Hebrew bidi correctly, PDF libraries don't.
  - Native would need `expo-print` + `expo-sharing` (not installed), so the buttons are hidden there.
- **Places data:**
  - Source: `app/backend/data/nearbyPlaces.json` (486 KB): named places within 20 km of each campsite that has coordinates (34 sites).
  - Built by `scripts/buildNearbyPlaces.js` from Geofabrik's Israel shapefile extract. The download is ~210 MB, so keep it outside the repo; usage is in the script header.
  - Why not live Overpass: it failed nearly every request on 2026-10-19 (406/500/timeouts) and throttles cloud IPs.
  - Refresh it when campsites change.
- **Limits:**
  - In SQL (`agent_consume()`): 30 messages and 3 itineraries per user per day, 1000 messages a day site-wide.
  - The hard cap is the monthly spend limit Nadav sets in the Anthropic Console.
- **Database:** migration `0004_travel_agent.sql` was **applied to the live project** on 2026-10-19.
- **Local dev:**
  - `npm run agent:dev` (repo root) serves the API on :8787 and loads `app/.env` (needs `ANTHROPIC_API_KEY`).
  - Start Expo with `EXPO_PUBLIC_AGENT_API_URL=http://localhost:8787`.
- **Tested on localhost against the real DB and API (desktop width):**
  - Hebrew packing question (21 s).
  - Off-topic coding request, declined.
  - Full 2-night Galilee family trip: 4 rounds, 61 s. It used real gate hours, phone numbers and nearby places from the data.
  - Saved, listed and opened the trip.
  - Download PDF: 3 A4 pages, Hebrew correct, page numbers "1 / 3".
  - Print view.
  - Prompt caching works.
- **Not tested yet:**
  - Phone width (the test browser wouldn't resize).
  - The real print dialog.
  - A signed-in chat on Vercel. The Preview deploy is verified as far as an unauthenticated call: `/api/agent/chat` answers 401 `unauthenticated` (function deployed, env vars present).
  - Native.
  - Delete itinerary.
- **Known limits:**
  - A page reload while the agent is working loses that reply from the chat (a saved itinerary is still in the tab).
  - Q&A answers take 10-20 s. Streaming or `effort: "low"` would speed that up.

## Waiting on Nadav
0. **Travel agent go-live:** `ANTHROPIC_API_KEY` is in Vercel (done 2026-10-19) and the branch is pushed. Still open: confirm the Anthropic monthly spend limit is set, try a signed-in chat on the Preview, and approve merging into `main`.
1. **Fresh live test** of everything above, ideally on a real phone too. Native (iOS/Android) has not been run at all this round.
2. ~~About page copy~~ reviewed by Nadav 2026-10-18: removed the version line and the "where the data comes from" section.
3. ~~Native persistence~~ done: AsyncStorage added, hydrated at startup in `src/lib/storage.ts` (not yet tested on a device).
4. **Favorite control on the detail screen:** it's a labeled button ("הוספה לאתרים מועדפים"), not a heart in the app bar. The code comment says this was deliberate; confirm that's what you want.
5. **Supabase:** `server/` runs (`/api/health` OK), but `/api/sites` needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.

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
