# Architecture

```
                 +-------------------+
                 |   Expo app (app/) |
                 |  iOS / Android /  |
                 |   Web (via RNW)   |
                 +---------+---------+
                           | HTTPS (fetch)
                           v
                 +-------------------+
                 | Express API       |
                 |   (server/)       |
                 |  routes -> ctrl   |
                 |  -> services      |
                 +---------+---------+
                           | service-role key
                           v
                 +-------------------+
                 |     Supabase      |
                 | Postgres + PostGIS|
                 +-------------------+
```

## Why a backend in front of Supabase

`CLAUDE.md` calls for a Node/Express API that strictly separates routing
from business logic, rather than the Expo app talking to Supabase
directly. Two concrete reasons this skeleton follows that:

- **Row Level Security stays simple.** The `sites` table only grants public
  `select`; every write goes through the server using the service role
  key, which bypasses RLS. There's one place (`sites.service.ts`) that
  decides what's allowed, instead of RLS policies trying to encode every
  business rule.
- **Room to grow without touching the client.** Aggregation, geospatial
  queries (`findSitesNearby`), rate limiting, or a future admin/moderation
  flow for user-submitted sites can all be added in `server/` without any
  app changes.

## Layout

- `app/` — Expo Router project. `app/app/` holds file-based routes (a tab
  group for map/favorites/settings, plus a `site/[id]` detail screen);
  `app/src/` holds components, hooks, i18n, and the API client. Platform-
  specific files (`Map.native.tsx` / `Map.web.tsx`) let native (react-
  native-maps) and web (Leaflet) use different map libraries behind one
  `@/components/Map` import.
- `server/` — Express + TypeScript API. `routes/` wire URLs to
  `controllers/`, which parse/validate the request and delegate to
  `services/`, which hold all Supabase access and business logic.
- `supabase/migrations/` — SQL migrations, applied via the Supabase CLI or
  dashboard SQL editor. See `supabase/README.md`.

## Data model

See `app/src/types/site.ts` (frontend) and `server/src/types/site.ts`
(backend + the raw `SiteRow` shape returned by Postgres) for the `Site`
type: bilingual name/description, coordinates, price per night, structured
opening hours, an amenities flag set (water, electricity, toilets,
shower, shade, picnic tables, waste disposal, 4x4-required, cell
reception), photos, and contact info. The two copies are hand-synced for
now; promote to a shared workspace package if/when they need to stay
byte-for-byte identical.

## Not yet implemented (intentionally out of scope for the skeleton)

- Authentication (for user-submitted sites / moderation)
- Photo upload (Supabase Storage bucket + upload endpoint)
- Proximity search endpoint (`findSitesNearby` is stubbed with the
  PostGIS query it should run)
- Persisted favorites (currently in-memory per app session)
- Search/filtering UI
