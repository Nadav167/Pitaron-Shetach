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
- Row Level Security is on with a public **read-only** policy. All writes go through the backend using the service role key, which bypasses RLS — this is what "Strictly separate the API routing layer from the business logic" in `CLAUDE.md` is protecting: the app never talks to Supabase directly, only through `server/`.
