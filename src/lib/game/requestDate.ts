import { addDays, utcDateString } from "../date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A run started just before midnight UTC may be finished for this long after. */
export const ROLLOVER_GRACE_MS = 60 * 60_000;

/** A real calendar date in YYYY-MM-DD form (rejects e.g. 2026-13-45). */
export function isValidDate(d: unknown): d is string {
  if (typeof d !== "string" || !DATE_RE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && utcDateString(new Date(t)) === d;
}

/** Runs can be played for today, or for yesterday during the first hour after midnight UTC. */
export function isPlayableDate(date: string, now: number): boolean {
  const today = utcDateString(new Date(now));
  const midnight = Date.parse(`${today}T00:00:00Z`);
  return date === today || (date === addDays(today, -1) && now - midnight < ROLLOVER_GRACE_MS);
}
