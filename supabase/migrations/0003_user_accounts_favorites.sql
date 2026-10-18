-- CampingIL / פתרון שטח — user accounts and per-user favorites
--
-- Accounts use Supabase Auth (auth.users): it stores the email and a hashed
-- password, and issues the session tokens. We never see or store passwords.
-- This migration adds the two tables of our own that hang off it:
--
--   profiles   one row per user: first and last name (shown in the header's
--              "welcome" message).
--   favorites  one row per (user, campsite) the user has saved.
--
-- The Expo app talks to these tables directly with the public "anon" key, so
-- Row Level Security is what keeps users apart: every policy below limits a
-- user to rows whose user id is their own (`auth.uid()`). With RLS on and no
-- policy for an action, that action is denied.
--
-- Run it in the Supabase dashboard's SQL editor (or `supabase db push`).

-- 1. Profiles ------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 50),
  last_name   text not null check (char_length(last_name)  between 1 and 50),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The profile row is created by the database itself when the account is
-- created, from the first/last name the register form sends as sign-up
-- metadata. Doing it in a trigger (rather than a second insert from the
-- app) means an account can never exist without its profile, even if the
-- app loses its connection between the two steps.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), '-'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), '-')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Favorites -----------------------------------------------------------------

-- `campsite_id` is the app's campsite id (e.g. "gc-ein-zivan-night-campground").
-- It is deliberately not a foreign key: the campsite list ships inside the app
-- (app/assets/data/campsites.json), not in this database.
create table if not exists public.favorites (
  user_id      uuid not null references auth.users (id) on delete cascade,
  campsite_id  text not null check (char_length(campsite_id) between 1 and 200),
  created_at   timestamptz not null default now(),
  primary key (user_id, campsite_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users read their own favorites" on public.favorites;
create policy "Users read their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "Users add their own favorites" on public.favorites;
create policy "Users add their own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users remove their own favorites" on public.favorites;
create policy "Users remove their own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
