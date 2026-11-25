import { describe, expect, it } from "vitest";
import { generateDaily } from "../puzzle/generate";
import { applyAttempt, MIN_ROUND_MS, newSession, startRound, summarize, SUSPICIOUS_ROUND_MS, type SessionState } from "./session";
import { toView } from "./view";

const challenge = generateDaily("2026-11-20");
const wrongIndex = (round: number, k = 0) => {
  const a = challenge.answers[round - 1];
  return [0, 1, 2, 3].filter((i) => i !== a)[k];
};

/** A new run whose round-1 picture was served at time t. */
const fresh = (t: number) => startRound(newSession("s", "u", "2026-11-20", t), t)!;

function must(o: ReturnType<typeof applyAttempt>) {
  if (!o.ok) throw new Error(o.error);
  return o;
}

/** Plays the correct answer for the current round, `delay` ms after it was handed out. */
function solve(s: SessionState, delay = 0): SessionState {
  const started = s.roundStartedAt ?? 0;
  const o = must(applyAttempt(s, { round: s.currentRound, index: challenge.answers[s.currentRound - 1] }, challenge, started + delay));
  return o.state.status === "active" ? startRound(o.state, started + delay + 1000)! : o.state;
}

describe("session rules", () => {
  it("a perfect fast game scores 750", () => {
    let s = fresh(0);
    for (let round = 1; round <= 5; round++) s = solve(s, MIN_ROUND_MS);
    expect(s.status).toBe("complete");
    const sum = summarize(s);
    expect(sum.totalScore).toBe(750);
    expect(sum.perfectRounds).toBe(5);
    expect(sum.accuracy).toBe(1);
  });

  it("hides the answer until the round is over and allows max 3 attempts", () => {
    let s = fresh(0);
    let o = must(applyAttempt(s, { round: 1, index: wrongIndex(1, 0) }, challenge, 1000));
    expect(o.revealIndex).toBeNull();
    expect(o.attemptsLeft).toBe(2);
    s = o.state;
    o = must(applyAttempt(s, { round: 1, index: wrongIndex(1, 1) }, challenge, 2000));
    expect(o.revealIndex).toBeNull();
    s = o.state;
    o = must(applyAttempt(s, { round: 1, index: wrongIndex(1, 2) }, challenge, 3000));
    expect(o.roundOver).toBe(true);
    expect(o.roundScore).toBe(0);
    expect(o.revealIndex).toBe(challenge.answers[0]);
    expect(o.state.currentRound).toBe(2);
    // no fourth attempt on round 1
    expect(applyAttempt(o.state, { round: 1, index: challenge.answers[0] }, challenge, 4000)).toEqual({
      ok: false,
      error: "wrong_round",
    });
  });

  it("second-attempt success earns the 10-point bonus; third earns none", () => {
    const s = fresh(0);
    const o1 = must(applyAttempt(s, { round: 1, index: wrongIndex(1) }, challenge, 0));
    expect(must(applyAttempt(o1.state, { round: 1, index: challenge.answers[0] }, challenge, 0)).roundScore).toBe(135);
    const o2 = must(applyAttempt(o1.state, { round: 1, index: wrongIndex(1, 1) }, challenge, 0));
    expect(must(applyAttempt(o2.state, { round: 1, index: challenge.answers[0] }, challenge, 99_000)).roundScore).toBe(100);
  });

  it("rejects skipping rounds, bad indices and duplicate taps", () => {
    const s = fresh(0);
    expect(applyAttempt(s, { round: 3, index: 0 }, challenge, 0)).toMatchObject({ ok: false, error: "wrong_round" });
    expect(applyAttempt(s, { round: 1, index: 999 }, challenge, 0)).toMatchObject({ ok: false, error: "invalid_index" });
    expect(applyAttempt(s, { round: 1, index: 1.5 }, challenge, 0)).toMatchObject({ ok: false, error: "invalid_index" });
    const o = must(applyAttempt(s, { round: 1, index: wrongIndex(1) }, challenge, 0));
    expect(applyAttempt(o.state, { round: 1, index: wrongIndex(1) }, challenge, 0)).toMatchObject({
      ok: false,
      error: "already_tried",
    });
  });

  it("times each round from when its puzzle was handed out (server clock)", () => {
    const s = fresh(10_000);
    const o = must(applyAttempt(s, { round: 1, index: challenge.answers[0] }, challenge, 20_000));
    expect(o.state.rounds[0].timeMs).toBe(10_000);
    expect(o.state.roundStartedAt).toBeNull();
    const next = startRound(o.state, 25_000)!;
    expect(next.roundStartedAt).toBe(25_000);
    expect(startRound(next, 30_000)).toBeNull(); // already started: clock is not reset
  });

  it("does not accept taps for a round until its picture has been served", () => {
    const unseen = newSession("s", "u", "2026-11-20", 0);
    expect(applyAttempt(unseen, { round: 1, index: challenge.answers[0] }, challenge, 10)).toEqual({ ok: false, error: "round_not_started" });
    const o = must(applyAttempt(fresh(0), { round: 1, index: challenge.answers[0] }, challenge, 1000));
    const view = toView(o.state, challenge, 1000);
    expect(view.roundStarted).toBe(false);
    expect(view.puzzle?.round).toBe(2);
    expect(applyAttempt(o.state, { round: 2, index: challenge.answers[1] }, challenge, 1001)).toEqual({
      ok: false,
      error: "round_not_started",
    });
    const started = startRound(o.state, 5000)!;
    expect(toView(started, challenge, 5000).roundStarted).toBe(true);
  });

  it("never sends shapes (or answers) to the browser", () => {
    const v = toView(fresh(0), challenge, 100);
    expect(v.puzzle).not.toHaveProperty("shapes");
    expect(JSON.stringify(v)).not.toMatch(/shapes|fill|rotation|answer|revealIndex/i);
    expect(v.imageUrl).toMatch(/^\/api\/session\/image\?date=2026-11-20&round=1&v=\d+$/);
  });

  it("flags runs with repeated superhuman first-try finds, but not normal fast play", () => {
    let bot = fresh(0);
    for (let round = 1; round <= 5; round++) bot = solve(bot, 300);
    expect(bot.flagged).toBe(true);
    expect(summarize(bot).totalScore).toBe(750); // the player still sees their score

    let human = fresh(0);
    for (let round = 1; round <= 5; round++) human = solve(human, round <= 2 ? SUSPICIOUS_ROUND_MS - 100 : 1800);
    expect(human.flagged).toBe(false);
  });

  it("counts impossibly fast taps as the minimum round time", () => {
    const s = fresh(10_000);
    const o = must(applyAttempt(s, { round: 1, index: challenge.answers[0] }, challenge, 10_050));
    expect(o.state.rounds[0].timeMs).toBe(MIN_ROUND_MS);
  });

  it("does not mutate the previous state", () => {
    const s: SessionState = fresh(0);
    const before = JSON.stringify(s);
    applyAttempt(s, { round: 1, index: challenge.answers[0] }, challenge, 5);
    startRound(s, 5);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rejects attempts after completion", () => {
    let s = fresh(0);
    for (let round = 1; round <= 5; round++) s = solve(s, 2000);
    expect(applyAttempt(s, { round: 5, index: 0 }, challenge, 0)).toEqual({ ok: false, error: "session_complete" });
  });

  it("reports no wrong taps for a fresh round", () => {
    expect(toView(fresh(0), challenge, 100).wrong).toEqual([]);
  });
});
