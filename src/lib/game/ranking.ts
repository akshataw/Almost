/** Shared ranking helpers (used by the in-memory store and tests; SQL mirrors these rules). */
import { addDays } from "../date";

export type Finished = {
  userId: string;
  date: string;
  score: number;
  accuracy: number;
  timeMs: number;
  completedAt: number;
  perfectRounds: number;
};

/** Daily order: score desc, accuracy desc, time asc, earlier completion first. */
export function compareDaily(a: Finished, b: Finished): number {
  return (
    b.score - a.score ||
    b.accuracy - a.accuracy ||
    a.timeMs - b.timeMs ||
    a.completedAt - b.completedAt
  );
}

export type Aggregate = { score: number; accuracy: number; timeMs: number; lastCompleted: number };

/** Weekly / all-time order — mirrors ranked() in SQL: score desc, avg accuracy desc, time asc, earlier last completion. */
export function compareAggregate(a: Aggregate, b: Aggregate): number {
  return b.score - a.score || b.accuracy - a.accuracy || a.timeMs - b.timeMs || a.lastCompleted - b.lastCompleted;
}

/** Sum each player's best daily runs into one aggregate per player. */
export function aggregate(rows: Finished[]): Map<string, Aggregate & { days: number }> {
  const out = new Map<string, Aggregate & { days: number; accSum: number }>();
  for (const f of rows) {
    const a = out.get(f.userId) ?? { score: 0, accuracy: 0, timeMs: 0, lastCompleted: 0, days: 0, accSum: 0 };
    a.score += f.score;
    a.timeMs += f.timeMs;
    a.days += 1;
    a.accSum += f.accuracy;
    a.accuracy = a.accSum / a.days;
    a.lastCompleted = Math.max(a.lastCompleted, f.completedAt);
    out.set(f.userId, a);
  }
  return out;
}

/** Best completed run per user per date. */
export function bestPerUserDate(rows: Finished[]): Finished[] {
  const best = new Map<string, Finished>();
  for (const r of rows) {
    const key = `${r.userId}|${r.date}`;
    const cur = best.get(key);
    if (!cur || compareDaily(r, cur) < 0) best.set(key, r);
  }
  return [...best.values()];
}

/** Streaks from a set of played dates. Current streak counts today or yesterday as live. */
export function streaks(dates: string[], today: string): { current: number; longest: number } {
  const set = new Set(dates);
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}
