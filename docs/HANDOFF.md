# Handoff (2026-10-18): where the project stands

Read this before starting. Older detail is in `docs/ARCHITECTURE.md` and the claude.ai project docs.

## State of the repo
- `main` is pushed and live (2026-10-18), including `user-accounts`. Repo: `github.com/Nadav167/Pitaron-Shetach`.
- **Hosting:** Vercel project `pitaron-shetach` (root dir `app`, `npx expo export -p web`, output `dist`), auto-deploys `main`. Live at https://pitaron-shetach.vercel.app (old https://camping-il-server.vercel.app still works). `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are set for Production + Preview. `app/vercel.json` rewrites every path to `index.html` (fixes 404 on refresh/deep links). The old `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` vars were deleted 2026-10-18; `PORT` / `CORS_ORIGIN` remain (unused, harmless).
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

## Waiting on Nadav
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
