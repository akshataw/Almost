# THE ALMOST — MVP build plan

## Context
Greenfield build (project folder is empty; Node 24 / npm 11 available, no Supabase CLI). Goal: ship the locked MVP of **almost.** — a daily perception game (5 SVG puzzles, 3 attempts each, server-scored, daily/weekly/all-time leaderboards, share card, PWA) on Next.js + Tailwind + hosted Supabase + Vercel. Decisions confirmed: **hosted Supabase** (user supplies keys in `.env.local`; I write SQL migrations to paste/apply), **full MVP in plan order**: puzzle engine → game UI → scoring → Supabase → leaderboards → share → PWA.

## Stack
- Next.js (latest, App Router, TypeScript, `src/`), Tailwind v4, `motion` (Framer Motion), `next/font/google` (Space Grotesk / Inter / JetBrains Mono)
- `@supabase/supabase-js` + `@supabase/ssr`; anonymous auth for guests
- `next/og` `ImageResponse` for PNG share card
- Vitest for engine/scoring/validation tests
- Hand-written `public/sw.js` + `app/manifest.ts` for PWA (no plugin)

Design tokens in `globals.css` `@theme`: ink `#111318`, paper `#F2F0E9`, signal `#D8A94F`, anomaly `#7189D9`. Dark-ink background, paper text, generous whitespace, poster-like geometric compositions.

## Project structure
```
src/app/
  page.tsx                  Home/landing (experiment #, headline, 5-dot indicator, CTA, player count, streak, top-5 preview)
  play/page.tsx             Client state machine: intro → round 1..5 → results (+ share)
  leaderboard/page.tsx      Tabs: daily | weekly | all-time, "load more", highlight me
  profile/page.tsx          Username (editable), streaks, totals, avg, best, recent results, "link email" prompt
  about/page.tsx
  manifest.ts, icon assets
  api/session/start/route.ts     POST → creates/returns today's session, round 1 puzzle (no answer)
  api/session/attempt/route.ts   POST {sessionId, round, index} → server validates, scores, returns result/next puzzle
  api/card/[sessionId]/route.tsx GET → 1200×630 PNG score card
src/components/  Nav (top desktop / bottom mobile), PuzzleCanvas (SVG), RoundHud, ResultsPanel, LeaderboardTable, ShareButton
src/lib/puzzle/  rng.ts (string hash + mulberry32), types.ts, size.ts, color.ts, rotation.ts, combined.ts, generate.ts, validate.ts
src/lib/scoring.ts       pure scoring (shared by server + tests)
src/lib/supabase/        client.ts (browser), server.ts (cookies/SSR), admin.ts (service role, server-only)
src/lib/date.ts          UTC day helpers, experiment number = days since launch date + 1
supabase/migrations/0001_init.sql
scripts/seed-challenges.ts   pre-generate N days into daily_challenges
```

## Puzzle engine (Day 2)
- `seed = \`almost-${date}-v1\`` → per-round sub-seed `${seed}-r${n}` → mulberry32. Same date+version ⇒ identical output (tested).
- Output: `{ type, cols, rows, viewBox, shapes:[{kind,cx,cy,size,rotation,fill}], instruction }` + separate `answerIndex` (never sent to client).
- Daily format: R1 size/easy (5×5), R2 color/easy (5×5), R3 rotation/medium (6×6), R4 size+rotation/medium (6×6), R5 combined/hard (7×7).
- Deltas by difficulty (tunable): size 14%→6%, color HSL lightness 9→3 pts, rotation 16°→6°. Rotation rounds use asymmetric shapes (triangle, L, half-circle) so rotation is visible. Each day's palette/shape family is seeded for variety.
- `validate.ts`: rejects puzzles below a minimum perceptible delta or where the anomaly is ambiguous; generator retries with a bumped sub-seed.

## Game flow & scoring (Day 3)
- Answers live server-side, so **every tap is a server call** (`/api/session/attempt`); client shows optimistic selection scale, then:
  - wrong → brief SVG distortion (feTurbulence/shake) on the tapped element, attempts decrement, answer **not** revealed
  - correct → quiet reveal (anomaly pulses in Signal color), auto-advance
  - 3rd miss → round scores 0, anomaly gently revealed, advance
- Round timing uses **server timestamps** (round start stored when the previous round resolves). Timer in UI is display-only.
- `scoring.ts`: correct 100 + first-attempt 25 / second-attempt 10 + speed `25·max(0, 1 − t/T)` (T = 20s easy, 25s medium, 30s hard), rounded; max 150/round, 750/day.
- Results screen: score/750, time, perfect rounds (first-try correct), accuracy, daily position, % players beaten, personal best, share.
- Intro screen skipped after first visit (localStorage flag).

## Supabase (Day 4) — `0001_init.sql`
- Tables per spec: `profiles`, `daily_challenges` (+ `answer_key jsonb` column), `game_sessions` (+ `challenge_date`, `round_started_at`, `current_round`, `status`), `round_results`.
- Unique `(user_id, challenge_id)` on `game_sessions` → one ranked run per player per day (refresh resumes the in-progress session; replays show today's result). Leaderboard SQL still uses "best completed score per user per date" so the rule holds if replays are added later.
- RLS: `daily_challenges` no client access (API uses service role); `game_sessions`/`round_results` select-own only, no client insert/update (all writes via API); `profiles` select-all (public names), update-own.
- Trigger on `auth.users` insert → profile with anonymous name (e.g. `quietobserver-482`).
- Guest auth: `supabase.auth.signInAnonymously()` on first load; profile page offers `updateUser({ email })` to link an email (magic link). Requires enabling Anonymous sign-ins in the Supabase dashboard.
- Challenge resolution: API reads today's row; if missing, generates deterministically and inserts it (so launch never breaks). `scripts/seed-challenges.ts` pre-generates the next 30 days for review.

## Leaderboards & profile (Day 5)
SQL functions (security definer, read-only):
- `leaderboard(period text, p_date date, lim int, off int)` — daily: score desc, accuracy desc, completion_time asc, completed_at asc; weekly: sum of daily bests within ISO week (Mon–Sun UTC, `date_trunc('week')`); all-time: sum since launch.
- `my_rank(period, p_date)` → rank, score, total players (for highlight + percentile).
- `profile_stats(uid)` → total played, avg, best, current/longest streak (gaps-and-islands over distinct `challenge_date`), recent 10.
- Indexes on `game_sessions(challenge_date, total_score desc)` and `(user_id, challenge_date)`.

## Polish, share, PWA (Day 6)
- Motion: fade-in puzzles, 0.95→1 scale on tap, distortion on miss, reveal on correct; sound toggle (WebAudio blips, off by default, persisted locally).
- Share: text per spec copied via `navigator.share` → clipboard fallback; PNG card from `/api/card/[sessionId]` (shares file when `navigator.canShare({files})`, else download link).
- PWA: `manifest.ts` (name, icons 192/512/maskable, ink theme), `sw.js` caching app shell + fonts, network-first for API; registered in root layout.

## Testing & launch (Day 7)
- Vitest: determinism (same seed ⇒ deep-equal output across 365 dates), validator (no ambiguous puzzles across 365 dates), scoring table cases (150/135/100/0, speed bonus bounds), attempt validation (no 4th attempt, no skipping rounds, duplicate tap idempotency).
- SQL check script: seed fake users/sessions, assert daily/weekly/all-time rankings and tie-breaks.
- Manual: `npm run dev`, play through on desktop + mobile viewport (375px), refresh mid-round resumes, second visit skips intro, leaderboard highlights self, share text/PNG, Lighthouse PWA installability.
- Deploy to Vercel with env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCH_DATE`.

## Known limitations (accepted for MVP)
- SVG attributes are inspectable in DevTools, so a determined cheater can find anomalies; answer keys still never leave the server and scoring is server-side. Advanced anti-cheat is out of scope per spec.
- Phase 2 puzzle types (missing element, pattern break), social login, avatars deferred.

## Immediate next steps (on approval)
1. Save this plan as `plan.md` in the project root.
2. Finish Day 1: `src/lib/config.ts` (rejected earlier), landing page (`src/app/page.tsx` + client `HomeLive`), About page, then `npm run build` check. Already written: globals.css, layout.tsx, Nav.tsx, Logo.tsx, date.ts.
3. Continue Day 2 onward, ticking items in `tasks.md` as they complete.

## What I need from you during the build
- Supabase project URL, anon key, service-role key in `.env.local`; Anonymous sign-ins enabled; run the migration in the SQL editor (or I give you the exact steps).
- Vercel account for deploy (Day 7).
