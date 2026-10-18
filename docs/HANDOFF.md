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

## User-testing feedback, 2026-10-12 (do these after committing)

A tester used the live app and sent this feedback. Nadav wants all of it done. Hebrew strings below are final copy, so use them exactly.

### A. Rebrand: the site is now called "פתרון שטח"
- Name: **פתרון שטח**. Slogan directly under it: **כל חניוני הלילה והקמפינג בישראל**.
- English: name "Pitron Shetach", slogan "All of Israel's night parking and campsites".
- This replaces the current Home hero ("מצאו חניון לילה" plus "כל אתרי הקמפינג והחניה הלילית בישראל, במקום אחד"). The tester said that title and subtitle don't match, and the heading should cover the whole offering.
- Update everywhere the brand appears: Home hero (mobile + desktop), mobile brand row, `DesktopNav` brand mark, `app.json` name / web page title, and `he.json` / `en.json`. The repo/folder name stays CampingIL.

### B. Search (highest-priority bugs)
1. **You can't type a word.** After the first letter, focus jumps away from the input (onto the filter chips). Likely cause: `SearchBar` is rendered inside `SiteList`'s `header` / `ListHeaderComponent` (`index.tsx` line ~72, `SiteList.tsx` line ~46/61), so it remounts when the list re-renders or switches between FlatList and the empty state. Fix: render the search bar *outside* the list, or otherwise keep it mounted, and verify you can type a full word on both mobile and desktop widths.
2. **Matching is too narrow.** Typing "דרום" returns "לא נמצאו אתרים". Search must help someone who doesn't know exactly what they want. Match against name (he + en), region (including Hebrew/English region names and the north/central/south buckets in `src/lib/sort.ts`, so "דרום" / "צפון" / "מרכז" / "south" work), address and description. Normalize (trim, lowercase, ignore niqqud/punctuation), and consider simple fuzzy matching.
3. **Irrelevant results.** Searching "ניצן" showed sites that don't contain it. This is probably a side effect of bug 1 (only the first letter got typed). Re-test after fixing 1, and make sure results actually match the query.

### C. Site detail screen
4. **Back arrow points the wrong way.** In RTL, the top-right back arrow must point right (→). Appbar.BackAction at `app/site/[id].tsx` ~line 98 doesn't mirror; flip the icon when `isRTL`.
5. **Two favorite buttons:** the heart in the appbar plus the "הוסף למועדפים" button (~line 152). Keep only the heart.
6. **Hover tooltip on the heart** (cards + detail): "הוספה לאתרים מועדפים" (remove: "הסרה מהמועדפים"). English: "Add to favorites" / "Remove from favorites".
7. **Missing-info message.** When fields show "לא ידוע" (price / hours / etc.), show a friendly note: "אוי! לא הצלחנו למצוא כמה פרטים על המקום. אם יש שאלות, תמיד אפשר לנסות להתקשר למספר!" (English: "Oops! We couldn't find some details about this place. If you have questions, you can always try calling the number!"). If the site has no phone, drop the second sentence.
8. **Footer line "מקור נקודת הציון: amudanan.co.il" still renders LTR.** It must be RTL. The mixed Latin domain flips the paragraph direction, so set `writingDirection: 'rtl'` / `textAlign: 'right'` explicitly, or wrap the domain in an LTR isolate. Check the "data from" line too.

### D. Map
9. **Restrict the map to Israel.** Users can currently pan to the rest of the world, which feels like no real product work went into it. Set `maxBounds` (Israel bbox plus a small margin, with `maxBoundsViscosity: 1`) and a sensible `minZoom` in `Map.web.tsx`, and the equivalent region limits in `Map.native.tsx`.

### E. Switching language must not move anything (layout stays fixed)
10. Clarified by Nadav: when switching Hebrew ↔ English, **the whole layout stays exactly where it is**. Nothing mirrors or moves to the other side: not the language button, the tabs, the back arrow, the heart, card layouts or icons. Only the text changes language.
    - The layout is always the Hebrew (RTL) layout. Decouple layout direction from locale: stop calling `I18nManager.forceRTL/allowRTL` on language change (see `LocaleContext.tsx`), and keep layout RTL permanently.
    - Today many components use `isRTL` (from the locale) to flip positions, alignment or icons. Those should read a constant layout direction instead, so they don't flip when the language changes. Search for every `isRTL` usage and decide per case.
    - Text inside its own box can still read naturally in English (`writingDirection: 'ltr'` for English strings), but the boxes themselves don't move. If a specific spot looks odd with English text, ask Nadav rather than mirroring it.

### F. Settings and About
11. **The Settings tab has nothing useful.** Its only controls are theme and language, and those are already on screen. Remove the Settings tab (tabs become Home / Map / Favorites). Keep the existing on-screen theme + language toggles, and make sure they're reachable on mobile too, not just in the desktop nav.
12. **Add an "About" (אודות) page** with real content: what פתרון שטח is, where the data comes from (רשות הטבע והגנים / parks.org.il, gocamping.co.il, coordinates via tiuli.com / amudanan.co.il), that unofficial sites may be inaccurate, and a contact/feedback line. Draft the copy in Hebrew + English and flag it for Nadav to review. Link to it from the nav/footer.

### G. Favorites
13. Add the same filter chips (All / Camping sites / Night parkings), search and sort to the Favorites screen. Reuse the components from Home, and ideally extract the filter/search/sort logic into a shared hook.

After finishing, run `npx tsc --noEmit` and ask Nadav for a fresh live test. Several past rounds were only caught by real testing.

## Open items (older)
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
