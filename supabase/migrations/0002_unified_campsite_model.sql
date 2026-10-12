-- CampingIL — unify official and non-official campsites in one table
--
-- Background: the app now ingests two sources with one shape (see
-- app/src/types/campsite.ts and scripts/scrapeCampsites.js):
--   * parks.org.il     — Nature and Parks Authority night camping grounds
--   * gocamping.co.il  — community / private campsites
--
-- Three things change here:
--
-- 1. `is_official` — the distinction the UI is built around. Official sites
--    have published prices, enforced gate hours and a booking system; the
--    non-official ones are third-party listings that go stale. The app shows
--    a warning on the latter, so this can't be inferred at render time.
--
-- 2. lat/lng become nullable. Neither source publishes coordinates, so they're
--    recovered from secondary sources and a few sites have none. Listing such
--    a site without a pin is correct; inventing a plausible coordinate for a
--    night-navigation app is not. The generated `location` column resolves to
--    null for these rows, which ST_DWithin excludes from radius searches
--    automatically — exactly the behaviour we want.
--
-- 3. `photos` becomes jsonb. gocamping serves generic stock images captioned
--    "תמונה להמחשה" for several listings, and the app must not present those
--    as photographs of the place, so each photo carries an `isPlaceholder`
--    flag rather than being a bare URL string.
--
-- Run via `supabase db push` or paste into the SQL editor.

-- 1. Source / provenance -----------------------------------------------------

alter table sites
  add column if not exists is_official   boolean not null default false,
  add column if not exists source_url    text,
  add column if not exists coords_source text,
  add column if not exists needs_review  boolean not null default false;

comment on column sites.is_official is
  'True for Nature and Parks Authority night camping grounds; false for third-party listings.';
comment on column sites.coords_source is
  'Where the coordinate came from — often a different site than source_url. Lets a bad pin be traced without re-scraping.';
comment on column sites.needs_review is
  'Set when sources disagreed, or the pin describes the venue rather than the pitch.';

create index if not exists sites_is_official_idx on sites (is_official);

-- 2. Coordinates become optional ---------------------------------------------

alter table sites
  alter column lat drop not null,
  alter column lng drop not null;

-- 3. Pricing -----------------------------------------------------------------
-- `price_per_night` alone can't distinguish "free" from "we don't know",
-- and both occur in the data.

alter table sites
  add column if not exists price_is_free boolean not null default false,
  add column if not exists price_note    text;

comment on column sites.price_is_free is
  'True only when a source explicitly says the site is free. A null price_per_night means unknown.';

-- Backfill from the old convention, where 0 meant free.
update sites set price_is_free = true where price_per_night = 0 and price_is_free = false;

-- 4. Photos: text[] -> jsonb -------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'sites' and column_name = 'photos' and data_type = 'ARRAY'
  ) then
    alter table sites rename column photos to photos_legacy;
    alter table sites add column photos jsonb not null default '[]'::jsonb;

    update sites
      set photos = coalesce(
        (select jsonb_agg(jsonb_build_object('url', url)) from unnest(photos_legacy) as url),
        '[]'::jsonb
      );

    alter table sites drop column photos_legacy;
  end if;
end $$;

comment on column sites.photos is
  'Array of {url, isPlaceholder?, credit?}. isPlaceholder marks a generic stock image the source used in place of a real photo.';

-- 5. Opening hours gains check-in / check-out --------------------------------
-- Stored inside the existing opening_hours jsonb as { note, checkIn, checkOut },
-- so no column change is needed — documented here so the shape is discoverable.

comment on column sites.opening_hours is
  'jsonb: { note?: string, checkIn?: "HH:MM", checkOut?: "HH:MM", days?: { sun..sat: { open, close } } }';
