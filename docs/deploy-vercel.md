# Deploying almost. to Vercel (Hobby)

Secrets never go into code, git, chat or `vercel.json`. They are pasted **only** into
Vercel → Settings → Environment Variables, straight from the Supabase dashboard (or your local `.env.local`).

## Before you start
- Supabase → **Project Settings → General → Region**: note it (e.g. `ap-south-1`, Mumbai). Vercel's server
  code should run in the same region; every tap talks to the database ~3 times.
- The GitHub repo can stay **public**: it holds no secrets. The daily puzzles are seeded with `PUZZLE_SECRET`,
  so the public code can't be used to compute answers. Never commit that value.

## 1. Import the project
1. vercel.com → sign up / log in **with GitHub** (Hobby plan).
2. **Add New → Project** → import `Almost`. When GitHub asks, give the Vercel app access to **only this repository**.
3. Framework: **Next.js** (auto-detected). Root directory `./`. Leave build and install commands as default.

## 2. Environment variables (before clicking Deploy)
Paste values exactly, no quotes, no spaces. Tick **Production only** for all of them.

| Name | Value from | Sensitive? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | no (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **Publishable** key | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Secret** key | **yes — turn on "Sensitive"** |
| `PUZZLE_SECRET` | the `PUZZLE_SECRET=` line in your local `.env.local` (copy the value after `=`) | **yes — turn on "Sensitive"** |

Why Production only: preview deployments (other branches / pull requests) then can't touch the real
database. Without these variables a preview runs in the built-in demo mode (data isn't saved), which is
fine for checking the look of a change.

Then click **Deploy**. The first build takes ~1–2 minutes and gives you a URL like `https://almost-xxxx.vercel.app`.

## 3. After the first deploy (Vercel → your project → Settings)
1. **Functions → Function Region**: pick the region closest to your Supabase region → Save.
2. **Environment Variables**: add `SITE_ORIGIN` = your production URL, e.g. `https://almost-xxxx.vercel.app`
   (no trailing slash, Production only). Used for login email links.
3. **Build and Deployment → Node.js Version**: `24.x` (matches local development).
4. **Deployment Protection**: keep **Vercel Authentication → Standard Protection** (previews private, production public).
   Under **Git → Fork Protection**, keep it **on** so pull requests from other people's forks never build with your variables.
5. **Deployments → latest → ⋯ → Redeploy** so steps 1–3 take effect.

## 4. Supabase settings for the live site
1. **Authentication → URL Configuration**
   - Site URL: your production URL
   - Redirect URLs: add `https://almost-xxxx.vercel.app/**` (keep `http://localhost:3100/**` for local dev)
2. **Authentication → Emails → Templates**: add the code line (see `docs/auth-setup.md`).
3. Before inviting players: **Authentication → Emails → SMTP Settings** (custom email provider).

## 5. Check it works
- Open the site on your phone, play today's experiment, check the leaderboard and profile.
- Browser menu → **Add to Home Screen** (installable app).
- Vercel → **Usage**: watch function invocations against the Hobby limit.

## If a secret ever leaks
Supabase → Project Settings → **API Keys** → create a new secret key and delete the old one → paste the new
one into Vercel (`SUPABASE_SERVICE_ROLE_KEY`) → Redeploy. Update your local `.env.local` too.

If `PUZZLE_SECRET` ever leaks: generate a new one (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`),
put it in `.env.local` and Vercel, bump `PUZZLE_VERSION` in `src/lib/config.ts`, and run `npm run seed`.

## Ongoing
- Puzzles are pre-generated through 2026-12-29. Before then, run locally: `npm run seed -- 30 2026-12-30`
  (if you forget, each day's puzzle is generated automatically on first play).
- Every push to `main` deploys to production automatically.
