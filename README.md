# Pitron Shetach · פתרון שטח

A map of every camping and night-parking site in Israel — about 400 sites, with photos, location, prices, opening hours, contact details and amenities — plus an AI trip planner that builds itineraries around them.

**Live:** https://pitaron-shetach.vercel.app

Hebrew-first (full RTL) with an English toggle. One codebase runs as a website and as an iOS/Android app.

## Features

- **Map and search** over ~405 campsites: filters by region, amenities and site type (night camp / campground), search that works in Hebrew and English, tolerates typos and matches by town radius.
- **Site pages** with photos (credited per CC BY-SA), prices, gate hours, contact info and amenities (water, electricity, toilets, shade, 4x4 access, cell reception…).
- **User accounts** (Supabase Auth): register, log in, and keep favorites in the database. Guest favorites are merged into the account on login.
- **AI trip planner** for signed-in users: answers camping questions and plans multi-day trips using the app's own campsites and real places near them, then saves the itinerary to the user's account. Itineraries export to PDF.

## Stack

| Layer | Choice |
|---|---|
| App + website | Expo (React Native + Expo Router), web via react-native-web, TypeScript |
| Maps | Leaflet / OpenStreetMap on web, `react-native-maps` on native |
| Database & auth | Supabase (PostgreSQL + PostGIS), Row Level Security |
| Serverless API | Vercel functions (`app/api/`) for the AI agent |
| REST API | Node.js + Express, routes → controllers → services (`server/`) |
| AI | Anthropic Claude API with tool use |
| Data collection | Node.js scripts with Puppeteer, Cheerio and OpenStreetMap extracts |

## How it works

```
 Expo app (web / iOS / Android)
   │  Supabase Auth + favorites (RLS: each user sees only their rows)
   │  campsite dataset (app/assets/data/campsites.json)
   ▼
 /api/agent/chat  (Vercel function)
   │  tool-use loop: get_campsite_details · find_nearby_places · save_itinerary
   ▼
 Claude API  +  Supabase (itineraries, per-user daily limits in SQL)
```

**Campsite data.** `scripts/` builds the dataset from several sources: a hand-checked core set, OpenStreetMap
(`importOsmCampsites.js`) and tiuli.com (`importTiuliCampsites.js`). The importers drop mistagged points, skip
duplicates within 500 m (or 2 km with a shared name word), name unnamed sites by the nearest town, add English
names, and attach Commons photos found near each site. `buildNearbyPlaces.js` precomputes the named places within
20 km of every site from an OSM extract, so the agent doesn't depend on a live, rate-limited API.

**Trip planner.** `app/backend/agent/runAgent.ts` runs a manual tool-use loop: it calls the model, runs any tools
it asks for in parallel, sends the results back, and repeats until it answers in text (max 10 rounds). The campsite
index sits in a cached system prompt. Database calls use the caller's own token, so Row Level Security applies.
Usage is capped in SQL (`agent_consume()`): 30 messages and 3 itineraries per user per day.

**PDF export.** Itineraries are drawn page by page on a canvas and packed by a small hand-written PDF writer,
because canvas renders Hebrew right-to-left correctly where PDF libraries don't.

## Project layout

```
app/        Expo app and website, plus the Vercel functions (app/api) and agent backend (app/backend)
server/     Express REST API
supabase/   SQL migrations (schema, accounts, favorites, agent tables)
scripts/    Data import and enrichment scripts
docs/       Architecture notes and current status (HANDOFF.md)
```

## Running locally

```bash
npm install                        # npm workspaces: app + server
cp app/.env.example app/.env       # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY, ANTHROPIC_API_KEY for the agent
npm run app                        # Expo: press w for web, or scan the QR code
npm run agent:dev                  # optional: agent API on :8787
```

Without Supabase keys the account features are hidden and the rest of the app still works.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`supabase/README.md`](supabase/README.md) for details.

## Data sources

OpenStreetMap contributors (ODbL), Wikimedia Commons (photo credits shown per site), Israel Nature and Parks
Authority and tiuli.com public listings.
