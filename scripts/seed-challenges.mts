/**
 * Pre-generates daily challenges into Supabase so they can be reviewed before they go live.
 * Usage: npm run seed -- [days=30] [startDate=today UTC]
 * Never prints secrets or answer keys.
 */
import { createClient } from "@supabase/supabase-js";
import { PUZZLE_VERSION } from "../src/lib/config";
import { addDays, utcDateString } from "../src/lib/date";
import { generateDaily } from "../src/lib/puzzle/generate";
import { requirePuzzleSecret } from "../src/lib/puzzle/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars (run with --env-file=.env.local)");
  process.exit(1);
}

const secret = requirePuzzleSecret(); // without it, anyone with the public code could compute the answers
const days = Number(process.argv[2] ?? 30);
const start = process.argv[3] ?? utcDateString();
const db = createClient(url, key, { auth: { persistSession: false } });

const allRows = Array.from({ length: days }, (_, i) => {
  const date = addDays(start, i);
  const c = generateDaily(date, PUZZLE_VERSION, secret);
  return {
    challenge_date: date,
    version: PUZZLE_VERSION,
    puzzle_data: { seed: c.seed, puzzles: c.puzzles },
    answer_key: { answers: c.answers },
    active: true,
  };
});

// Retire other generator versions for these dates (kept for history, just not active).
// Dates that already have games are left alone so nobody's in-progress puzzle changes.
const dates = allRows.map((r) => r.challenge_date);
const { data: played, error: playedErr } = await db.from("game_sessions").select("challenge_date").in("challenge_date", dates);
if (playedErr) {
  console.error("Seed failed:", playedErr.message);
  process.exit(1);
}
const playedDates = new Set((played ?? []).map((r) => r.challenge_date as string));
const replaceable = dates.filter((d) => !playedDates.has(d));
const { error: retireErr } = await db
  .from("daily_challenges")
  .update({ active: false })
  .in("challenge_date", replaceable)
  .neq("version", PUZZLE_VERSION);
if (retireErr) {
  console.error("Seed failed:", retireErr.message);
  process.exit(1);
}
if (playedDates.size) console.log(`Kept existing puzzles for ${playedDates.size} date(s) that already have games.`);
const rows = allRows.filter((r) => !playedDates.has(r.challenge_date));

const { data, error } = await db
  .from("daily_challenges")
  .upsert(rows, { onConflict: "challenge_date,version", ignoreDuplicates: true })
  .select("challenge_date");
if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}
console.log(`Seeded ${data?.length ?? 0} new challenge(s) from ${start} for ${days} day(s); existing dates left unchanged.`);
