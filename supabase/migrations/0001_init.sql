-- CampingIL initial schema
-- Run via `supabase db push` (Supabase CLI) or paste into the SQL editor
-- in the Supabase dashboard for your project.

create extension if not exists "pgcrypto";   -- for gen_random_uuid()
create extension if not exists "postgis";    -- for geospatial (nearby-search) queries

create table if not exists sites (
  id                uuid primary key default gen_random_uuid(),

  -- Bilingual content (Hebrew primary, English secondary — see app i18n)
  name_he           text not null,
  name_en           text not null,
  description_he    text,
  description_en    text,

  region            text not null,           -- e.g. "Negev", "Golan", "Dead Sea"

  lat               double precision not null,
  lng               double precision not null,
  -- Generated geography point, kept in sync with lat/lng automatically.
  -- Enables efficient radius queries, e.g.:
  --   select * from sites
  --   where ST_DWithin(location, ST_MakePoint(:lng, :lat)::geography, :radius_m);
  location          geography(Point, 4326)
                      generated always as (
                        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                      ) stored,

  address           text,

  price_per_night   numeric(8,2),             -- null/0 = free
  opening_hours     jsonb not null default '{}'::jsonb,
  amenities         jsonb not null default '{
    "water": false,
    "electricity": false,
    "toilets": false,
    "shower": false,
    "shade": false,
    "picnicTables": false,
    "wasteDisposal": false,
    "fourByFourRequired": false,
    "cellReception": false
  }'::jsonb,
  photos            text[] not null default '{}',

  contact_phone     text,
  contact_website   text,
  contact_email     text,

  rating            numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  source            text,                     -- e.g. "seed", "user-submission", "gov-dataset"

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sites_location_idx on sites using gist (location);
create index if not exists sites_region_idx on sites (region);

-- Keep updated_at current on every row update.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_set_updated_at on sites;
create trigger sites_set_updated_at
  before update on sites
  for each row execute function set_updated_at();

-- Row Level Security: public read access, writes restricted to the
-- service role (used only by the server/ backend, never the app).
alter table sites enable row level security;

drop policy if exists "Public read access" on sites;
create policy "Public read access"
  on sites for select
  using (true);

-- No insert/update/delete policy is created for the anon/authenticated
-- roles, so only requests made with the service role key (server-side)
-- can write. Add an authenticated-write policy later if/when the app
-- needs user-submitted sites.
