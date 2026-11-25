import "server-only";
import { after } from "next/server";
import { PUZZLE_VERSION } from "../config";
import { generateDaily } from "../puzzle/generate";
import type { DailyChallenge, PuzzleSpec } from "../puzzle/types";
import { supabaseAdmin } from "../supabase/admin";
import { streaks } from "./ranking";
import { summarize, type SessionState } from "./session";
import type { GameStore, LeaderboardPeriod, LeaderboardRow } from "./store";

type ChallengeRow = {
  id: string;
  challenge_date: string;
  version: number;
  puzzle_data: { seed: string; puzzles: PuzzleSpec[] };
  answer_key: { answers: number[] };
};

type RankedRow = { rank: number; user_id: string; username: string; score: number; days: number; time_ms: number };

const challengeCache = new Map<string, DailyChallenge>();

/** The session cookie points at an auth user that has been deleted. */
export class StaleIdentityError extends Error {
  constructor() {
    super("stale identity");
    this.name = "StaleIdentityError";
  }
}

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`[almost] ${where}: ${error?.message ?? "unknown error"}`);
}

function fromRow(r: ChallengeRow): DailyChallenge {
  return {
    id: r.id,
    date: r.challenge_date,
    version: r.version,
    seed: r.puzzle_data.seed,
    puzzles: r.puzzle_data.puzzles,
    answers: r.answer_key.answers,
  };
}

async function loadChallenge(date: string): Promise<DailyChallenge | null> {
  const { data, error } = await supabaseAdmin()
    .from("daily_challenges")
    .select("id, challenge_date, version, puzzle_data, answer_key")
    .eq("challenge_date", date)
    .eq("active", true)
    .maybeSingle<ChallengeRow>();
  if (error) fail("load challenge", error);
  return data ? fromRow(data) : null;
}

/** Inserts a generated challenge if none exists for the date (used by the API fallback and the seed script). */
export async function ensureChallenge(date: string, version = PUZZLE_VERSION): Promise<DailyChallenge> {
  const existing = await loadChallenge(date);
  if (existing) return existing;
  const c = generateDaily(date, version);
  const { error } = await supabaseAdmin()
    .from("daily_challenges")
    .upsert(
      {
        challenge_date: date,
        version,
        puzzle_data: { seed: c.seed, puzzles: c.puzzles },
        answer_key: { answers: c.answers },
        active: true,
      },
      { onConflict: "challenge_date,version", ignoreDuplicates: true },
    );
  if (error) fail("insert challenge", error);
  const stored = await loadChallenge(date);
  if (!stored) fail("insert challenge", { message: "not found after insert" });
  return stored;
}

function sessionColumns(s: SessionState) {
  const sum = summarize(s);
  return {
    status: s.status,
    current_round: s.currentRound,
    round_started_at: s.roundStartedAt === null ? null : new Date(s.roundStartedAt).toISOString(),
    started_at: new Date(s.startedAt).toISOString(),
    total_score: sum.totalScore,
    completion_time_ms: sum.completionTimeMs,
    accuracy: sum.accuracy,
    perfect_rounds: sum.perfectRounds,
    completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
    flagged: s.flagged ?? false,
    state: s,
    version: s.version,
  };
}

/** Ranked rows for a period. Only ask PostgREST for a total count when the caller needs it. */
function ranked(period: LeaderboardPeriod, date: string, withCount = false) {
  return supabaseAdmin().rpc("ranked", { p_period: period, p_date: date }, withCount ? { count: "exact" } : undefined);
}

function toRow(r: RankedRow): LeaderboardRow {
  return { rank: Number(r.rank), userId: r.user_id, username: r.username, score: Number(r.score), days: Number(r.days), timeMs: Number(r.time_ms) };
}

async function ensureProfile(userId: string) {
  // the auth trigger normally creates it; this covers users created before the migration ran
  await supabaseAdmin()
    .from("profiles")
    .upsert({ id: userId, username: `observer-${userId.replace(/-/g, "").slice(0, 10)}` }, { onConflict: "id", ignoreDuplicates: true });
}

export const supabaseStore: GameStore = {
  async getChallenge(date) {
    const cached = challengeCache.get(date);
    if (cached) return cached;
    const c = await ensureChallenge(date);
    challengeCache.set(date, c);
    return c;
  },

  async getSession(userId, date) {
    const { data, error } = await supabaseAdmin()
      .from("game_sessions")
      .select("state")
      .eq("user_id", userId)
      .eq("challenge_date", date)
      .maybeSingle<{ state: SessionState }>();
    if (error) fail("get session", error);
    return data?.state ?? null;
  },

  async createSession(state) {
    const challenge = await this.getChallenge(state.date);
    const [{ data, error }] = await Promise.all([
      supabaseAdmin()
        .from("game_sessions")
        .insert({ id: state.id, user_id: state.userId, challenge_id: challenge.id, challenge_date: state.date, ...sessionColumns(state) })
        .select("state")
        .maybeSingle<{ state: SessionState }>(),
      ensureProfile(state.userId),
    ]);
    if (data) return data.state;
    // 23503: the auth user behind this cookie no longer exists (deleted account)
    if (error?.code === "23503") throw new StaleIdentityError();
    // 23505: a run for this player/date already exists (e.g. two tabs) — return that one
    if (error && error.code !== "23505") fail("create session", error);
    const stored = await this.getSession(state.userId, state.date);
    if (!stored) fail("create session", { message: "not found after insert" });
    return stored;
  },

  async saveSession(state, prevVersion) {
    const { data, error } = await supabaseAdmin()
      .from("game_sessions")
      .update(sessionColumns(state))
      .eq("id", state.id)
      .eq("version", prevVersion)
      .select("id");
    if (error) fail("save session", error);
    if (!data || data.length === 0) return false;

    // round_results is an analytics copy of state.rounds. Write the latest finished round after
    // the response is sent (idempotent upsert), so the player never waits on it.
    const justFinished = state.rounds.filter((r) => r.done).at(-1);
    if (justFinished) {
      after(async () => {
        const { error: rErr } = await supabaseAdmin()
          .from("round_results")
          .upsert(
            {
              session_id: state.id,
              round_number: justFinished.round,
              selected_index: justFinished.selectedIndex,
              attempts: justFinished.attempts,
              correct: justFinished.correct,
              score: justFinished.score,
              time_ms: justFinished.timeMs,
            },
            { onConflict: "session_id,round_number" },
          );
        if (rErr) console.error("[almost] save round:", rErr.message);
      });
    }
    return true;
  },

  async getStanding(userId, date) {
    const db = supabaseAdmin();
    const [mine, totalRes, bestRes] = await Promise.all([
      ranked("daily", date).eq("user_id", userId).maybeSingle<RankedRow>(),
      db.from("game_sessions").select("id", { count: "exact", head: true }).eq("challenge_date", date).eq("status", "complete").eq("flagged", false),
      db
        .from("game_sessions")
        .select("total_score")
        .eq("user_id", userId)
        .eq("status", "complete")
        .order("total_score", { ascending: false })
        .limit(1)
        .maybeSingle<{ total_score: number }>(),
    ]);
    if (mine.error) fail("standing", mine.error);
    const me = mine.data;
    if (!me) return null;
    const total = totalRes.count ?? 1;
    const best = bestRes.data;
    const rank = Number(me.rank);
    return {
      rank,
      totalPlayers: total,
      beatenPct: total > 1 ? (total - rank) / (total - 1) : 1,
      personalBest: best?.total_score ?? Number(me.score),
    };
  },

  async getLeaderboard(period, date, userId, limit, offset) {
    const none = Promise.resolve({ data: null, error: null });
    const [page, mine, first] = await Promise.all([
      ranked(period, date, true).range(offset, offset + limit - 1),
      userId ? ranked(period, date).eq("user_id", userId).maybeSingle<RankedRow>() : none,
      offset > 0 ? ranked(period, date).limit(1).maybeSingle<RankedRow>() : none,
    ]);
    if (page.error) fail("leaderboard", page.error);
    if (mine.error) fail("leaderboard me", mine.error);
    if (first.error) fail("leaderboard top", first.error);
    const me = mine.data ? toRow(mine.data) : null;
    const top = offset === 0 ? (page.data as RankedRow[])[0] : first.data;
    return {
      rows: ((page.data ?? []) as RankedRow[]).map(toRow),
      total: page.count ?? 0,
      me,
      topScore: top ? Number(top.score) : null,
    };
  },

  async getProfile(userId, today) {
    const db = supabaseAdmin();
    const [profileRes, { data: sessions, error }, userRes] = await Promise.all([
      db.from("profiles").select("username").eq("id", userId).maybeSingle<{ username: string }>(),
      db
        .from("game_sessions")
        .select("challenge_date, total_score, completion_time_ms, perfect_rounds")
        .eq("user_id", userId)
        .eq("status", "complete")
        .order("challenge_date", { ascending: false }),
      db.auth.admin.getUserById(userId),
    ]);
    if (error) fail("profile", error);
    if (profileRes.error) fail("profile name", profileRes.error);
    if (userRes.error) fail("profile user", userRes.error);
    const profile = profileRes.data;
    const user = userRes.data;
    const rows = (sessions ?? []) as { challenge_date: string; total_score: number; completion_time_ms: number; perfect_rounds: number }[];
    const { current, longest } = streaks(rows.map((r) => r.challenge_date), today);
    return {
      username: profile?.username ?? "observer",
      isGuest: user.user?.is_anonymous ?? false,
      email: user.user?.email ?? null,
      currentStreak: current,
      longestStreak: longest,
      played: rows.length,
      averageScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.total_score, 0) / rows.length) : 0,
      bestScore: rows.length ? Math.max(...rows.map((r) => r.total_score)) : 0,
      recent: rows.slice(0, 10).map((r) => ({ date: r.challenge_date, score: r.total_score, timeMs: r.completion_time_ms, perfectRounds: r.perfect_rounds })),
    };
  },

  async getAccount(userId) {
    const db = supabaseAdmin();
    const [profileRes, userRes] = await Promise.all([
      db.from("profiles").select("username").eq("id", userId).maybeSingle<{ username: string }>(),
      db.auth.admin.getUserById(userId),
    ]);
    if (profileRes.error) fail("account name", profileRes.error);
    if (userRes.error) fail("account user", userRes.error);
    return {
      username: profileRes.data?.username ?? "observer",
      isGuest: userRes.data.user?.is_anonymous ?? false,
      email: userRes.data.user?.email ?? null,
    };
  },

  async setUsername(userId, username) {
    const { data, error } = await supabaseAdmin().from("profiles").update({ username }).eq("id", userId).select("id");
    if (!error && data && data.length > 0) return { ok: true };
    if (!error) return { ok: false, error: "no_profile" };
    if (error.code === "23505") return { ok: false, error: "taken" };
    if (error.code === "23514") return { ok: false, error: "invalid" };
    fail("set username", error);
  },

  async getHomeStats(userId, date) {
    const db = supabaseAdmin();
    const [{ count }, top, mine] = await Promise.all([
      db.from("game_sessions").select("id", { count: "exact", head: true }).eq("challenge_date", date),
      ranked("daily", date).limit(5),
      userId
        ? db.from("game_sessions").select("challenge_date").eq("user_id", userId).eq("status", "complete")
        : Promise.resolve({ data: [] as { challenge_date: string }[] }),
    ]);
    if (top.error) fail("home top", top.error);
    return {
      players: count ?? 0,
      streak: streaks(((mine.data ?? []) as { challenge_date: string }[]).map((r) => r.challenge_date), date).current,
      top: ((top.data ?? []) as RankedRow[]).map((r) => ({ rank: Number(r.rank), username: r.username, score: Number(r.score) })),
    };
  },
};

/**
 * A guest logged into an existing account on this device: move the guest's runs into the account
 * (for dates the account hasn't played), then delete the now-unused guest. Returns runs moved.
 */
export async function mergeGuestInto(guestId: string, userId: string): Promise<number> {
  if (guestId === userId) return 0;
  const db = supabaseAdmin();
  const guest = await db.auth.admin.getUserById(guestId);
  if (guest.error || !guest.data.user?.is_anonymous) return 0; // only ever merge throwaway guest accounts

  const [mine, theirs] = await Promise.all([
    db.from("game_sessions").select("challenge_date").eq("user_id", userId),
    db.from("game_sessions").select("id, challenge_date, state").eq("user_id", guestId),
  ]);
  if (mine.error) fail("merge (account runs)", mine.error);
  if (theirs.error) fail("merge (guest runs)", theirs.error);
  const taken = new Set((mine.data ?? []).map((r) => r.challenge_date as string));

  let moved = 0;
  for (const row of (theirs.data ?? []) as { id: string; challenge_date: string; state: SessionState }[]) {
    if (taken.has(row.challenge_date)) continue; // the account already has a run that day: keep the account's
    const { error } = await db
      .from("game_sessions")
      .update({ user_id: userId, state: { ...row.state, userId } })
      .eq("id", row.id)
      .eq("user_id", guestId);
    if (error) fail("merge (move run)", error);
    moved++;
  }
  // the guest account is empty now (or only holds duplicate days): remove it and its leftovers
  const del = await db.auth.admin.deleteUser(guestId);
  if (del.error) console.error("[almost] could not delete merged guest:", del.error.message);
  return moved;
}
