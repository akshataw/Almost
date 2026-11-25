# almost. — MVP task list

> Everything looks right. Something isn't.

Build order: Puzzle engine → Game UI → Scoring → Supabase → Leaderboards → Share → PWA.
Mark each item `[x]` when it's done.

## Secrets & setup rules
- [x] `.gitignore` excludes `.env`, `.env*.local`, and `.vercel/`
- [ ] `.env.example` lists variable names only (no values) — skipped for now (declined earlier)
- [ ] Real keys live only in `.env.local` (local ✓, chmod 600) and in Vercel environment variables (deploy — pending)
- [x] `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/supabase/env.ts` (`server-only`), never `NEXT_PUBLIC_`
- [x] No keys in source, tests, logs, screenshots, or the share card (scanned source + build output)

## Day 1 — Foundation and visual identity
- [x] Create Next.js project (TypeScript, App Router, `src/`)
- [x] Set up Tailwind v4 with design tokens (ink, paper, signal, anomaly)
- [x] Load fonts: Space Grotesk, Inter, JetBrains Mono
- [x] Root layout with nav: compact top nav (desktop), bottom nav (mobile) — Home, Leaderboard, Profile, About
- [x] Home / landing page: logo, experiment number, headline, five-puzzle indicator, START EXPERIMENT, player count, streak, leaderboard preview
- [x] About page
- [x] Responsive layout checked at 375px and desktop widths (checked with headless screenshots)

## Day 2 — Puzzle engine
- [x] Seeded RNG (`almost-${date}-v1` → string hash + mulberry32)
- [x] Puzzle types and shared data shape (shapes + separate answer index)
- [x] Size anomaly generator
- [x] Color anomaly generator
- [x] Rotation anomaly generator (asymmetric shapes)
- [x] Combined anomaly generator (size + rotation, hard)
- [x] Daily set generator: 5 rounds with rising difficulty
- [x] Puzzle validator (minimum visible difference, no ambiguous anomaly)
- [x] SVG `PuzzleCanvas` renderer with tappable elements
- [x] Unit tests: same seed always gives the same puzzle; validator passes for 365 dates

## Day 3 — Gameplay
- [x] Intro screen ("Five patterns. Five anomalies."), skipped after first visit
- [x] Five-round game flow (play page state machine)
- [x] Round HUD: experiment number, round progress, instruction, timer, attempts left
- [x] Attempt handling: 3 per round, wrong answer not revealed while attempts remain
- [x] Scoring module (100 + 25/10 attempt bonus + 0–25 speed bonus, max 750)
- [x] Scoring unit tests
- [x] Results screen: score, time, perfect rounds, accuracy, position, % beaten, personal best

## Day 4 — Backend and authentication
- [x] Supabase project created (user) and keys added to `.env.local`
- [x] Anonymous sign-ins enabled in Supabase dashboard (verified live)
- [x] Migration `0001_init.sql`: profiles, daily_challenges (+ answer key), game_sessions, round_results
- [x] Migration `0002_grants.sql` applied (API role privileges; public key verified read-only)
- [x] Row Level Security policies
- [x] Trigger: new user gets a profile with an anonymous name
- [x] Guest auth (`signInAnonymously`, server-side, warmed while the intro plays) — verified live
- [x] Supabase clients: server (SSR cookies), admin (server-only) — no browser client needed
- [x] `POST /api/session/start` (today's session, puzzle without answer, resumes after refresh)
- [x] `POST /api/session/attempt` (server checks answer, attempts, round order, server timestamps, scoring)
- [x] One ranked session per player per day enforced (unique `(user_id, challenge_date)`)
- [x] Challenge fallback: generate and store today's puzzle if missing
- [x] `npm run seed` pre-generates challenges (35 days seeded: 2026-11-20 → 2026-12-24)
- [x] Game UI wired to the APIs

## Day 5 — Leaderboards and profile
- [x] SQL `ranked(period, date)` — daily ranking with tie-breaks (paged via API)
- [x] Weekly aggregation (Monday–Sunday UTC, sum of daily bests)
- [x] All-time aggregation (sum since launch)
- [x] Player's own rank for highlight and percentile (filter on `ranked()`)
- [x] Indexes for leaderboard queries
- [x] Leaderboard page: Daily / Weekly / All-time tabs, load more, current player highlighted, today's top score
- [x] Profile stats (played, average, best, current and longest streak, recent results) — computed server-side
- [x] Profile page: editable username, stats, recent results, "link email" prompt

## Day 6 — Polish and sharing
- [x] Animations: puzzle fade-in, tap scale, distortion on wrong, reveal on correct
- [x] Sound toggle (off by default, remembered)
- [x] Share text (Web Share API with copy fallback)
- [x] PNG score card (`/api/card`, player's own run) + share as file / save
- [x] PWA: manifest, icons (192/512/maskable), service worker
- [x] Test on mobile and desktop (headless screenshots, 375px + 1280px)

## Day 7 — Testing and launch
- [x] Test puzzle consistency across dates
- [x] Test score validation (no 4th attempt, no skipped rounds, duplicate taps)
- [x] Test leaderboard calculations and tie-breaks (unit tests + live SQL with simulated players)
- [x] Results survive refresh (mid-round resume and finished-run refresh verified live)
- [x] PWA installable (production check: manifest, icons, service worker control, offline shell)
- [ ] Deploy to Vercel with environment variables set there
- [ ] Invite first players

## Launch acceptance criteria
- [x] Daily puzzle: same puzzle for all users
- [x] Gameplay: five playable rounds
- [x] Mobile: works on small screens
- [x] Scoring: server-calculated score
- [x] Guest play: no mandatory signup
- [x] Daily leaderboard: correct rankings
- [ ] Weekly leaderboard: correct seven-day aggregation (logic unit-tested; live data has only one day so far)
- [ ] All-time leaderboard: correct cumulative scores (logic unit-tested; confirm after a few real days)
- [x] Persistence: results survive refresh
- [x] Sharing: copyable score summary (+ PNG card)
- [x] PWA: installable on supported devices

## Code review fixes (2026-11-24)
- [x] Puzzle data no longer gives the answer away: invisible per-shape jitter + validator rejects exact-value leaks (puzzle v3)
- [x] A round's clock starts when its picture is served; future rounds' pictures refused; early taps rejected
- [x] Email sign-in for linked profiles (superseded by the login flow below)
- [x] Game UI recovers from attempt errors instead of freezing; advance timer cleared on unmount
- [x] Leaderboard: parallel queries, counts only when needed, stale-tab responses ignored, unique row keys
- [x] Service worker caches only successful responses; cache versioned per build
- [x] Input validation: null bodies, real calendar dates, integer rounds/offsets
- [x] Profile errors surfaced; rename fails if no profile; forms recover from network errors
- [x] Weekly/all-time tie-break shared between dev store and SQL (`compareAggregate`) + tests
- [ ] Run `supabase/migrations/0003_review_fixes.sql` **and** `0004_flag_implausible_runs.sql` in SQL Editor (**required** — gameplay on Supabase needs them)
- [ ] At deploy: set `SITE_ORIGIN` in Vercel; add `https://<site>/auth/callback` to Supabase Redirect URLs
- [x] Bot protection: Cloudflare Turnstile on guest creation + email sign-in (off until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set)
- [ ] Turn it on: create a Turnstile widget in Cloudflare, add the site key to `.env.local` + Vercel, **then** enable CAPTCHA (Turnstile + secret) in Supabase → Authentication → Attack Protection
- [ ] Set Supabase → Authentication → Rate Limits → anonymous sign-ins per hour per IP (e.g. 10)
- [x] Puzzles rendered as images on the server: the browser never receives shapes, colours or angles
- [x] Implausibly fast perfect runs flagged and kept off the leaderboards (player still sees their score)

## Login (2026-11-25)
- [x] Guests keep playing with a generated name; "Log in" in the header, on the results screen and the profile
- [x] `/login`: email → 6-digit code (or link); guest + new email keeps progress; guest + existing account merges today's games
- [x] Log out; `/api/me` for the header; clear error messages (bad address, rate limit, email not allowed)
- [x] Live test: code login, guest-run merge, guest cleanup, logout, bad link (test account removed afterwards)
- [ ] Supabase dashboard setup — see `docs/auth-setup.md` (redirect URLs, `{{ .Token }}` in 3 email templates)
- [ ] Before inviting players: custom SMTP in Supabase (built-in email only reaches team members, ~2/hour)
