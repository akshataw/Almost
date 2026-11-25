/**
 * Server-side game rules. Pure functions: given the stored session, the official
 * answers and the server clock, decide what a tap means. Never trust the client.
 */
import { ATTEMPTS_PER_ROUND, ROUNDS_PER_DAY } from "../config";
import type { DailyChallenge } from "../puzzle/types";
import { roundScore } from "../scoring";

/** Fastest plausible human round; faster taps are counted as this long. */
export const MIN_ROUND_MS = 500;
/**
 * Plausibility: finding the anomaly on the first try faster than this (measured from the moment the
 * picture was served, so it includes download + render + network) is beyond human speed when it
 * happens repeatedly. Such runs keep their score for the player but are left off the leaderboards.
 */
export const SUSPICIOUS_ROUND_MS = 900;
export const SUSPICIOUS_ROUNDS = 3;
/** Clamp per-round time so stale tabs don't produce absurd values. */
export const MAX_ROUND_MS = 10 * 60_000;

export type RoundResult = {
  round: number;
  attempts: number;
  wrong: number[];
  selectedIndex: number | null;
  correct: boolean;
  score: number;
  timeMs: number;
  done: boolean;
};

export type SessionState = {
  id: string;
  userId: string;
  date: string;
  status: "active" | "complete";
  currentRound: number; // 1..5 while active
  /**
   * When the current round's puzzle was handed to the player (server clock, epoch ms).
   * null = the round's picture hasn't been served yet. It is stamped when the image is first
   * requested, so nobody can study a puzzle before its clock is running.
   */
  roundStartedAt: number | null;
  startedAt: number;
  completedAt: number | null;
  rounds: RoundResult[];
  version: number; // optimistic concurrency
  /** set on completion when the run looks automated; excluded from rankings */
  flagged?: boolean;
};

export type SessionSummary = {
  totalScore: number;
  completionTimeMs: number;
  correctRounds: number;
  perfectRounds: number;
  accuracy: number; // 0..1
  rounds: { round: number; score: number; attempts: number; correct: boolean; timeMs: number }[];
};

export type AttemptError =
  | "session_complete"
  | "wrong_round"
  | "invalid_index"
  | "already_tried"
  | "round_not_started";

export type AttemptOutcome =
  | { ok: false; error: AttemptError }
  | {
      ok: true;
      state: SessionState;
      correct: boolean;
      attemptsLeft: number;
      roundOver: boolean;
      /** anomaly index, only once the round is over */
      revealIndex: number | null;
      roundScore: number;
    };

export function newSession(id: string, userId: string, date: string, now: number): SessionState {
  return {
    id,
    userId,
    date,
    status: "active",
    currentRound: 1,
    roundStartedAt: null, // starts when round 1's picture is served
    startedAt: now,
    completedAt: null,
    rounds: Array.from({ length: ROUNDS_PER_DAY }, (_, i) => ({
      round: i + 1,
      attempts: 0,
      wrong: [],
      selectedIndex: null,
      correct: false,
      score: 0,
      timeMs: 0,
      done: false,
    })),
    version: 0,
  };
}

export function applyAttempt(
  prev: SessionState,
  input: { round: number; index: number },
  challenge: DailyChallenge,
  now: number,
): AttemptOutcome {
  if (prev.status === "complete") return { ok: false, error: "session_complete" };
  if (input.round !== prev.currentRound) return { ok: false, error: "wrong_round" };
  if (prev.roundStartedAt === null) return { ok: false, error: "round_not_started" };
  const roundStartedAt = prev.roundStartedAt;

  const puzzle = challenge.puzzles[input.round - 1];
  const answer = challenge.answers[input.round - 1];
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= puzzle.shapes.length) {
    return { ok: false, error: "invalid_index" };
  }

  const r0 = prev.rounds[input.round - 1];
  if (r0.wrong.includes(input.index)) return { ok: false, error: "already_tried" };

  const state: SessionState = structuredClone(prev);
  const r = state.rounds[input.round - 1];
  r.attempts += 1;
  r.selectedIndex = input.index;
  const correct = input.index === answer;
  if (!correct) r.wrong.push(input.index);

  const roundOver = correct || r.attempts >= ATTEMPTS_PER_ROUND;
  if (roundOver) {
    r.done = true;
    r.correct = correct;
    r.timeMs = Math.min(MAX_ROUND_MS, Math.max(MIN_ROUND_MS, now - roundStartedAt));
    r.score = roundScore({ correct, attempts: r.attempts, timeMs: r.timeMs, timeLimitMs: puzzle.timeLimitMs });
    if (state.currentRound >= ROUNDS_PER_DAY) {
      state.status = "complete";
      state.completedAt = now;
      state.flagged = isImplausible(state);
    } else {
      state.currentRound += 1;
      state.roundStartedAt = null; // stamped when the player asks for the next puzzle
    }
  }
  state.version += 1;

  return {
    ok: true,
    state,
    correct,
    attemptsLeft: ATTEMPTS_PER_ROUND - r.attempts,
    roundOver,
    revealIndex: roundOver ? answer : null,
    roundScore: r.score,
  };
}

export function isImplausible(state: SessionState): boolean {
  const tooFast = state.rounds.filter((r) => r.correct && r.attempts === 1 && r.timeMs < SUSPICIOUS_ROUND_MS);
  return tooFast.length >= SUSPICIOUS_ROUNDS;
}

/** Start the current round's clock (called when its picture is first served). No-op if already running. */
export function startRound(prev: SessionState, now: number): SessionState | null {
  if (prev.status !== "active" || prev.roundStartedAt !== null) return null;
  return { ...structuredClone(prev), roundStartedAt: now, version: prev.version + 1 };
}

export function summarize(state: SessionState): SessionSummary {
  const done = state.rounds.filter((r) => r.done);
  const correctRounds = done.filter((r) => r.correct).length;
  return {
    totalScore: done.reduce((s, r) => s + r.score, 0),
    completionTimeMs: done.reduce((s, r) => s + r.timeMs, 0),
    correctRounds,
    perfectRounds: done.filter((r) => r.correct && r.attempts === 1).length,
    accuracy: correctRounds / state.rounds.length,
    rounds: done.map(({ round, score, attempts, correct, timeMs }) => ({ round, score, attempts, correct, timeMs })),
  };
}
