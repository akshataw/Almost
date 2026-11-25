import { ATTEMPTS_PER_ROUND } from "../config";
import { experimentNumber } from "../date";
import { toPublicPuzzle, type DailyChallenge, type PublicPuzzle } from "../puzzle/types";
import { summarize, type SessionState, type SessionSummary } from "./session";
import type { Standing } from "./store";

/** What the browser is allowed to know about a run. No shapes, no answers for unfinished rounds. */
export type SessionView = {
  date: string;
  experiment: number;
  status: "active" | "complete";
  currentRound: number;
  /** layout of the current round (grid geometry + instruction); the picture comes from imageUrl */
  puzzle: PublicPuzzle | null;
  /** server-rendered picture of the current round; the round's clock starts when it is first served */
  imageUrl: string | null;
  /** whether the current round's clock is running (its image has been served) */
  roundStarted: boolean;
  /** ms already elapsed in the current round (server clock), for the display timer */
  roundElapsedMs: number;
  wrong: number[];
  attemptsLeft: number;
  rounds: { round: number; done: boolean; correct: boolean; attempts: number; score: number }[];
  summary: (SessionSummary & { standing: Standing | null; flagged: boolean }) | null;
};

export function puzzleImageUrl(date: string, round: number, version: number): string {
  return `/api/session/image?date=${date}&round=${round}&v=${version}`;
}

export function toView(
  s: SessionState,
  challenge: DailyChallenge,
  now: number,
  standing: Standing | null = null,
): SessionView {
  const r = s.rounds[s.currentRound - 1];
  const active = s.status === "active";
  const started = active && s.roundStartedAt !== null;
  return {
    date: s.date,
    experiment: experimentNumber(s.date),
    status: s.status,
    currentRound: s.currentRound,
    puzzle: active ? toPublicPuzzle(challenge.puzzles[s.currentRound - 1]) : null,
    imageUrl: active ? puzzleImageUrl(s.date, s.currentRound, challenge.version) : null,
    roundStarted: started,
    roundElapsedMs: started ? Math.max(0, now - (s.roundStartedAt as number)) : 0,
    wrong: active ? r.wrong : [],
    attemptsLeft: active ? ATTEMPTS_PER_ROUND - r.attempts : 0,
    rounds: s.rounds.map(({ round, done, correct, attempts, score }) => ({ round, done, correct, attempts, score })),
    summary: active ? null : { ...summarize(s), standing, flagged: s.flagged ?? false },
  };
}
