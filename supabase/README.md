# Supabase project setup

1. Create a project at [supabase.com](https://supabase.com) (or run Supabase locally with the Supabase CLI).
2. Apply the schema:
   - **Dashboard**: open the SQL editor and paste the contents of `migrations/0001_init.sql`, or
   - **CLI**: `supabase link --project-ref YOUR_PROJECT_REF` then `supabase db push`.
3. Copy the project URL and **service role key** (Project Settings → API) into `server/.env` (see `server/.env.example`). The service role key is server-only — never put it in the Expo app.
4. (Optional) Seed a few rows for local development:

   ```sql
   insert into sites (name_he, name_en, region, lat, lng, price_per_night, amenities)
   values (
     'חניון לילה - עין גדי', 'Ein Gedi Night Parking', 'Dead Sea',
     31.4618, 35.3822, 0,
     '{"water": false, "electricity": false, "toilets": true, "shower": false, "shade": false, "picnicTables": true, "wasteDisposal": true, "fourByFourRequired": false, "cellReception": true}'
   );
   ```

## Notes

- `postgis` is enabled and a generated `location geography(Point,4326)` column is kept in sync with `lat`/`lng` automatically, so proximity queries (`ST_DWithin`) don't require any extra write-path code. See the docstring above `findSitesNearby` in `server/src/services/sites.service.ts` for the query this unlocks.
- `sites`: Row Level Security is on with a public **read-only** policy. All writes go through the backend using the service role key, which bypasses RLS.
- **Accounts and favorites are the exception: the app talks to Supabase directly** (Supabase Auth + the `profiles` / `favorites` tables from `0003`), using the public anon key. RLS policies restrict every user to their own rows. Business logic for this lives in `app/src/services/` (`account.ts`, `favorites.ts`), separate from the screens.

## User accounts (migration 0003)

1. In the SQL editor, run `migrations/0003_user_accounts_favorites.sql`. It creates `profiles` (first/last name) and `favorites`, their RLS policies, and a trigger that creates the profile row when someone registers.
2. **Authentication → Sign In / Providers → Email**: keep Email enabled and turn **off** "Confirm email", so a new user is logged in right after registering.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `app/.env`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   Restart Expo with `-c` after changing `.env`. The anon key is meant to be public; the **service_role** key must never go in the app.
4. Registered users appear under **Authentication → Users**, their names in the `profiles` table, and their saved campsites in `favorites`.

## Travel agent (migration 0004)

1. In the SQL editor, run `migrations/0004_travel_agent.sql`. It creates `itineraries` (trips the agent saved for a user) and `agent_usage` (per-user daily counters), their RLS policies, and `agent_consume()`, the function that enforces the daily caps (30 messages and 3 itineraries per user, 1000 messages site-wide). Applied to the live project on 2026-10-19.
2. The agent itself is a Vercel function (`app/api/agent/chat.ts`, logic in `app/backend/`). It needs `ANTHROPIC_API_KEY` in Vercel's environment (mark it Sensitive) and in `app/.env` for local runs. It uses the same anon key as the app, with the caller's session token, so RLS applies to it too.
3. Saved trips appear in the `itineraries` table; today's usage per user in `agent_usage`.
