-- almost. — explicit API privileges
-- Newer Supabase projects don't auto-grant table access to API roles, so grant exactly what's needed.
-- Run once in Supabase Dashboard → SQL Editor after 0001_init.sql. Safe to re-run.

grant usage on schema public to anon, authenticated, service_role;

-- Server (secret key): full access to game tables, used only by Next.js API routes.
grant select, insert, update, delete on
  public.profiles, public.daily_challenges, public.game_sessions, public.round_results
  to service_role;
grant select on public.daily_best to service_role;
grant execute on function public.ranked(text, date) to service_role;

-- Browsers: read-only, further restricted by Row Level Security policies.
grant select on public.profiles to anon, authenticated;
grant select on public.game_sessions, public.round_results to authenticated;
-- daily_challenges (answer keys): intentionally no browser access.
