-- almost. — keep implausibly fast (likely automated) runs off the leaderboards
-- Run once in Supabase Dashboard → SQL Editor after 0003. Safe to re-run.
-- The player still sees their own score; the run is just not ranked.

alter table public.game_sessions add column if not exists flagged boolean not null default false;

create or replace view public.daily_best
with (security_invoker = true) as
select distinct on (user_id, challenge_date)
  user_id, challenge_date, total_score, accuracy, completion_time_ms, perfect_rounds, completed_at
from public.game_sessions
where status = 'complete' and not flagged
order by user_id, challenge_date, total_score desc, accuracy desc, completion_time_ms asc, completed_at asc;

-- keep the browser roles locked out of the recreated view
revoke all on public.daily_best from anon, authenticated;
grant select on public.daily_best to service_role;
