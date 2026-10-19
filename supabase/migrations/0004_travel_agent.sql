-- CampingIL / פתרון שטח — travel agent: saved itineraries and daily usage caps
--
-- The travel agent runs in a Vercel serverless function (app/api/agent/chat.ts).
-- It calls the Claude API with the site owner's API key, so every chat
-- message costs the owner money. Two tables back it:
--
--   itineraries  trips the agent planned for a user. The function inserts them
--                on the user's behalf (with the user's own session token, so
--                RLS applies); the app lists, opens and deletes them directly.
--   agent_usage  per-user, per-day counters of agent messages and saved
--                itineraries. Users can read their own row (to show "N left
--                today") but can never write it: it only changes through
--                agent_consume() below.
--
-- Run it in the Supabase dashboard's SQL editor after 0003.

-- 1. Itineraries ---------------------------------------------------------------

create table if not exists public.itineraries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  -- The whole plan as the agent produced it (days, stops, packing list...).
  -- Shape: ItineraryPlan in app/src/types/itinerary.ts.
  plan        jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists itineraries_user_created_idx
  on public.itineraries (user_id, created_at desc);

alter table public.itineraries enable row level security;

drop policy if exists "Users read their own itineraries" on public.itineraries;
create policy "Users read their own itineraries"
  on public.itineraries for select
  using (auth.uid() = user_id);

drop policy if exists "Users add their own itineraries" on public.itineraries;
create policy "Users add their own itineraries"
  on public.itineraries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own itineraries" on public.itineraries;
create policy "Users delete their own itineraries"
  on public.itineraries for delete
  using (auth.uid() = user_id);

-- 2. Daily usage caps ----------------------------------------------------------

create table if not exists public.agent_usage (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  messages     integer not null default 0,
  itineraries  integer not null default 0,
  primary key (user_id, day)
);

alter table public.agent_usage enable row level security;

-- Read-only for the user: no insert/update/delete policy, so those are denied.
drop policy if exists "Users read their own agent usage" on public.agent_usage;
create policy "Users read their own agent usage"
  on public.agent_usage for select
  using (auth.uid() = user_id);

-- Counts one agent message or one saved itinerary against the caller's daily
-- allowance and returns how many are left today after this one, or:
--   -1  the caller's own daily limit is used up
--   -2  the whole site's daily message limit is used up
-- The limits live here, not in the app, so a user calling this function
-- directly can only use up their own allowance. "Today" is Israel time.
--
-- Limits: 30 messages and 3 itineraries per user per day; 1000 messages per
-- day across all users (a backstop on the owner's API bill; the Anthropic
-- Console's monthly spend limit is the hard one).
create or replace function public.agent_consume(kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid           uuid := auth.uid();
  today         date := (now() at time zone 'Asia/Jerusalem')::date;
  user_limit    integer;
  global_limit  constant integer := 1000;
  used          integer;
  site_total    integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if kind = 'message' then
    user_limit := 30;
  elsif kind = 'itinerary' then
    user_limit := 3;
  else
    raise exception 'unknown usage kind: %', kind using errcode = '22023';
  end if;

  insert into public.agent_usage (user_id, day) values (uid, today)
  on conflict (user_id, day) do nothing;

  -- Row lock: two requests from the same user can't both take the last one.
  select case when kind = 'message' then u.messages else u.itineraries end
    into used
    from public.agent_usage u
   where u.user_id = uid and u.day = today
     for update;

  if used >= user_limit then
    return -1;
  end if;

  if kind = 'message' then
    select coalesce(sum(u.messages), 0) into site_total
      from public.agent_usage u
     where u.day = today;
    if site_total >= global_limit then
      return -2;
    end if;
    update public.agent_usage set messages = messages + 1
     where user_id = uid and day = today;
  else
    update public.agent_usage set itineraries = itineraries + 1
     where user_id = uid and day = today;
  end if;

  return user_limit - used - 1;
end;
$$;

revoke all on function public.agent_consume(text) from public, anon;
grant execute on function public.agent_consume(text) to authenticated;
