-- almost. — initial schema
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent where possible).

create extension if not exists pgcrypto;

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null check (username ~ '^[a-zA-Z0-9_.-]{3,24}$'),
  avatar_url  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ───────────────────────── daily_challenges ─────────────────
-- puzzle_data is what players see; answer_key never leaves the server.
create table if not exists public.daily_challenges (
  id              uuid primary key default gen_random_uuid(),
  challenge_date  date not null,
  version         integer not null default 1,
  puzzle_data     jsonb not null,
  answer_key      jsonb not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (challenge_date, version)
);
create unique index if not exists daily_challenges_one_active_idx
  on public.daily_challenges (challenge_date) where active;

-- ───────────────────────── game_sessions ────────────────────
create table if not exists public.game_sessions (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  challenge_id        uuid not null references public.daily_challenges(id),
  challenge_date      date not null,
  status              text not null check (status in ('active', 'complete')),
  current_round       integer not null,
  round_started_at    timestamptz not null,
  started_at          timestamptz not null,
  total_score         integer not null default 0 check (total_score between 0 and 750),
  completion_time_ms  integer not null default 0,
  accuracy            numeric(4,3) not null default 0,
  perfect_rounds      integer not null default 0,
  completed_at        timestamptz,
  state               jsonb not null,           -- full server-side round state
  version             integer not null default 0, -- optimistic concurrency
  unique (user_id, challenge_date)              -- one ranked run per player per day
);
create index if not exists game_sessions_daily_rank_idx
  on public.game_sessions (challenge_date, total_score desc, accuracy desc, completion_time_ms, completed_at)
  where status = 'complete';
create index if not exists game_sessions_user_date_idx on public.game_sessions (user_id, challenge_date);

-- ───────────────────────── round_results ────────────────────
create table if not exists public.round_results (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  round_number    integer not null check (round_number between 1 and 5),
  selected_index  integer,
  attempts        integer not null check (attempts between 1 and 3),
  correct         boolean not null,
  score           integer not null check (score between 0 and 150),
  time_ms         integer not null,
  created_at      timestamptz not null default now(),
  unique (session_id, round_number)
);

-- ───────────────────────── ranking ──────────────────────────
-- Best completed run per player per date (only one exists today, but the rule holds if replays are added).
create or replace view public.daily_best
with (security_invoker = true) as
select distinct on (user_id, challenge_date)
  user_id, challenge_date, total_score, accuracy, completion_time_ms, perfect_rounds, completed_at
from public.game_sessions
where status = 'complete'
order by user_id, challenge_date, total_score desc, accuracy desc, completion_time_ms asc, completed_at asc;

-- Ranked rows for a period. daily: one date; weekly: Mon–Sun (UTC) containing p_date; alltime: up to p_date.
-- Tie-break: score desc, accuracy desc, time asc, earlier completion first.
create or replace function public.ranked(p_period text, p_date date)
returns table (rank bigint, user_id uuid, username text, score bigint, days bigint, time_ms bigint)
language sql stable
set search_path = public
as $$
  with b as (
    select * from daily_best
    where case p_period
      when 'daily'  then challenge_date = p_date
      when 'weekly' then challenge_date between date_trunc('week', p_date)::date
                                            and date_trunc('week', p_date)::date + 6
      else challenge_date <= p_date
    end
  ), agg as (
    select user_id,
           sum(total_score)::bigint        as score,
           count(*)::bigint                as days,
           avg(accuracy)                   as accuracy,
           sum(completion_time_ms)::bigint as time_ms,
           max(completed_at)               as last_completed
    from b group by user_id
  )
  select row_number() over (order by a.score desc, a.accuracy desc, a.time_ms asc, a.last_completed asc) as rank,
         a.user_id, p.username, a.score, a.days, a.time_ms
  from agg a
  join profiles p on p.id = a.user_id
  order by rank;
$$;

-- ───────────────────────── new user → profile ───────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adj  text[] := array['quiet','patient','sharp','still','keen','silent','careful','subtle','steady','curious','lucid','calm'];
  noun text[] := array['observer','pattern','ghost','mind','eye','signal','lens','witness','shadow','prism','echo','glance'];
  h    bigint := abs(('x' || substr(md5(new.id::text), 1, 8))::bit(32)::int)::bigint;
  base text   := adj[1 + h % 12] || noun[1 + (h / 12) % 12];
  i    int    := 0;
begin
  loop
    begin
      insert into profiles (id, username)
      values (new.id, base || '-' || lpad(((h / 144 + i) % 10000)::text, 4, '0'));
      return new;
    exception when unique_violation then
      i := i + 1;
      if i > 50 then
        insert into profiles (id, username) values (new.id, 'observer-' || substr(md5(new.id::text), 1, 10))
        on conflict (id) do nothing;
        return new;
      end if;
    end;
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── security ─────────────────────────
-- All game writes and answer checks go through the Next.js server (service role).
-- Browsers may only read public profiles and their own results.
alter table public.profiles         enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.game_sessions    enable row level security;
alter table public.round_results    enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "own sessions" on public.game_sessions;
create policy "own sessions" on public.game_sessions for select to authenticated using (user_id = auth.uid());

drop policy if exists "own rounds" on public.round_results;
create policy "own rounds" on public.round_results for select to authenticated
  using (exists (select 1 from public.game_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- daily_challenges: no policies → no client access at all (answer keys stay server-side).

revoke all on public.daily_challenges from anon, authenticated;
revoke insert, update, delete on public.game_sessions, public.round_results, public.profiles from anon, authenticated;
revoke all on public.daily_best from anon, authenticated;
revoke execute on function public.ranked(text, date) from public, anon, authenticated;
grant execute on function public.ranked(text, date) to service_role;
