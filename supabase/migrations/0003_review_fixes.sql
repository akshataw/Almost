-- almost. — fixes from code review
-- Run once in Supabase Dashboard → SQL Editor after 0001 and 0002. Safe to re-run.

-- 1. The next round's start is stamped only when its puzzle is handed out, so it can be empty
--    between rounds (prevents studying the next puzzle during the reveal animation).
alter table public.game_sessions alter column round_started_at drop not null;

-- 2. New-user trigger: abs(int) overflowed for one md5 prefix (0x80000000) and aborted sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adj  text[] := array['quiet','patient','sharp','still','keen','silent','careful','subtle','steady','curious','lucid','calm'];
  noun text[] := array['observer','pattern','ghost','mind','eye','signal','lens','witness','shadow','prism','echo','glance'];
  h    bigint := abs(('x' || substr(md5(new.id::text), 1, 8))::bit(32)::int::bigint);
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

-- 3. Indexes: "players today" counts all sessions for a date (not only completed ones),
--    and (user_id, challenge_date) is already covered by the unique constraint.
create index if not exists game_sessions_date_idx on public.game_sessions (challenge_date);
drop index if exists public.game_sessions_user_date_idx;
