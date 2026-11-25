import { LAUNCH_DATE } from "./config";

const DAY_MS = 86_400_000;

/** YYYY-MM-DD for the given instant, in UTC. */
export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function parseUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Experiment number: 1 on launch day, counting up each UTC day. */
export function experimentNumber(date: string): number {
  return Math.floor((parseUtc(date) - parseUtc(LAUNCH_DATE)) / DAY_MS) + 1;
}

export function formatExperiment(n: number): string {
  return String(Math.max(n, 0)).padStart(3, "0");
}

/** Monday (UTC) of the ISO week containing date. */
export function weekStart(date: string): string {
  const t = parseUtc(date);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Mon=0
  return utcDateString(new Date(t - dow * DAY_MS));
}

export function addDays(date: string, days: number): string {
  return utcDateString(new Date(parseUtc(date) + days * DAY_MS));
}

/** ms until next 00:00 UTC */
export function msUntilReset(now: Date = new Date()): number {
  const next = parseUtc(utcDateString(now)) + DAY_MS;
  return next - now.getTime();
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
