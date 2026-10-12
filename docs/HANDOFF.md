# Handoff (2026-10-12): where the project stands

Read this before starting. Older detail is in `docs/ARCHITECTURE.md` and the claude.ai project docs.

## State of the repo
- `origin/main` = commit `1a80ea2` (Sep 15). The month of work after it is committed on the local branch `redesign-unified-data` (Oct 12), **not yet pushed or merged into `main`**.
- The `.claude/skills/` design skills are in the repo, as their own commit on that branch.
- `cd app && npx tsc --noEmit` passes clean.

## What the uncommitted work contains
- Unified campsite model (`app/src/types/campsite.ts`), 37-site dataset (`app/assets/data/campsites.json`), offline-first `useSites`/`useSite`, scraper (`scripts/scrapeCampsites.js`), migration `0002`.
- Redesign: light/dark theme tokens + `ThemeContext`, Rubik/Heebo fonts, 4 tabs (Home/Map/Favorites/Settings), desktop top nav at >=900px, search bar + sort menu, custom `FilterChip`, 16:9 card photos, favorite heart.
- RTL: Hebrew is the hard default. react-native-paper's `<Text>` hardcodes `textAlign: 'left'` and `List.Item`/`Chip` use physical padding. Override `textAlign` and use mirrored styles yourself; don't rely on Paper for RTL.

## Open items
1. Persist theme + language choice (currently resets on relaunch).
2. Map screen desktop layout.
3. Apply sort to Favorites and Map, not just Home.
4. Check map popups + Button labels for the Paper left-align bug.
5. Run the scraper live (`npm run scrape`); it has never made a real request. Compare against the committed JSON and treat a coordinate that moves as a red flag.
6. Review the 8 `needsReview` sites (esp. אכזיב, and the two Neot HaKikar khans).
7. `server/` has never had `npm install` run.

## Rules
- Follow `CLAUDE.md` (ask before installing new npm deps).
- Never move the project back into OneDrive (it breaks Metro's file scanning).
- Never ship guessed coordinates; null is correct when unverified.
- Run the app with: `cd app && npx expo start --web -c`
