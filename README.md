# CampingIL

An app and website that show every night parking / camping site in
Israel — photos, location, prices, opening hours, contact info, and
amenities (water, electricity, toilets, and more).

This is the project **skeleton**: navigation, screens, a typed data model,
an Express API, and a Supabase/PostGIS schema are all wired up with
placeholder/mock data so the app runs end-to-end before any real site
data exists.

## Stack

| Layer     | Choice                                                                 |
|-----------|-------------------------------------------------------------------------|
| App + web | [Expo](https://expo.dev) (React Native + Expo Router), rendering the same codebase to iOS, Android, and web via react-native-web |
| Backend   | Node.js + Express (TypeScript), routes → controllers → services        |
| Database  | PostgreSQL via [Supabase](https://supabase.com), with PostGIS for geospatial queries |
| Maps      | [Leaflet](https://leafletjs.com)/OpenStreetMap on web, `react-native-maps` with OSM tiles on native — no API key needed |
| Language  | Hebrew (RTL) primary, English toggle, via a small built-in i18n context |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit
together and what's intentionally not built yet.

## Project layout

```
app/       Expo app (iOS, Android, and the website)
server/    Express API
supabase/  SQL migrations for the Postgres schema
docs/      Architecture notes
```

## Getting started

### 1. Install dependencies

From the repo root (this is an npm workspaces monorepo):

```bash
npm install
```

> This skeleton lists the packages each part of the stack needs in
> `app/package.json` and `server/package.json`, but does **not** run the
> install for you — per `CLAUDE.md`, new dependencies should be confirmed
> before installing. Review the dependency lists, then run `npm install`.

### 2. Set up Supabase

Follow [`supabase/README.md`](supabase/README.md) to create a project and
apply `supabase/migrations/0001_init.sql`.

### 3. Configure environment variables

```bash
cp server/.env.example server/.env   # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
cp app/.env.example app/.env         # points the app at the local API by default
```

### 4. Run it

```bash
npm run server   # starts the Express API on :4000
npm run app      # starts Expo — press w for web, or scan the QR code for iOS/Android
```

Without a configured API, the app falls back to bundled mock sites so the
UI is still browsable (a small banner says so on the home screen).

## Data model

A `Site` (see `app/src/types/site.ts` / `server/src/types/site.ts`) has:
bilingual name + description, coordinates, region, price per night,
opening hours, an amenities flag set (water, electricity, toilets,
shower, shade, picnic tables, waste disposal, 4x4-required, cell
reception), photos, and contact info (phone/website/email).
