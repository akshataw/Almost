import "server-only";
import { addDays, weekStart } from "../date";
import { generateDaily } from "../puzzle/generate";
import type { DailyChallenge } from "../puzzle/types";
import { anonymousName } from "./names";
import { aggregate, bestPerUserDate, compareAggregate, compareDaily, streaks, type Finished } from "./ranking";
import { summarize, type SessionState } from "./session";
import type { GameStore, LeaderboardPage, LeaderboardPeriod, LeaderboardRow } from "./store";

/**
 * In-memory store for local development before Supabase is configured.
 * Data lives only as long as the dev server process.
 */
type Db = {
  challenges: Map<string, DailyChallenge>;
  sessions: Map<string, SessionState>; // key userId|date
  usernames: Map<string, string>;
};

const g = globalThis as unknown as { __almostDb?: Db };
const db: Db = (g.__almostDb ??= { challenges: new Map(), sessions: new Map(), usernames: new Map() });

const key = (userId: string, date: string) => `${userId}|${date}`;
const name = (userId: string) => db.usernames.get(userId) ?? anonymousName(userId);

function finished(): Finished[] {
  const out: Finished[] = [];
  for (const s of db.sessions.values()) {
    if (s.status !== "complete" || s.completedAt === null || s.flagged) continue; // flagged runs aren't ranked
    const sum = summarize(s);
    out.push({
      userId: s.userId,
      date: s.date,
      score: sum.totalScore,
      accuracy: sum.accuracy,
      timeMs: sum.completionTimeMs,
      completedAt: s.completedAt,
      perfectRounds: sum.perfectRounds,
    });
  }
  return bestPerUserDate(out);
}

function rankRows(period: LeaderboardPeriod, date: string): LeaderboardRow[] {
  const all = finished();
  if (period === "daily") {
    return all
      .filter((f) => f.date === date)
      .sort(compareDaily)
      .map((f, i) => ({ rank: i + 1, userId: f.userId, username: name(f.userId), score: f.score, timeMs: f.timeMs }));
  }
  const from = period === "weekly" ? weekStart(date) : "0000-01-01";
  const to = period === "weekly" ? addDays(weekStart(date), 6) : date;
  const agg = aggregate(all.filter((f) => f.date >= from && f.date <= to));
  return [...agg.entries()]
    .sort(([, a], [, b]) => compareAggregate(a, b))
    .map(([userId, a], i) => ({ rank: i + 1, userId, username: name(userId), score: a.score, days: a.days, timeMs: a.timeMs }));
}

export const memoryStore: GameStore = {
  async getChallenge(date) {
    let c = db.challenges.get(date);
    if (!c) {
      c = generateDaily(date);
      db.challenges.set(date, c);
    }
    return c;
  },
  async getSession(userId, date) {
    const s = db.sessions.get(key(userId, date));
    return s ? structuredClone(s) : null;
  },
  async createSession(state) {
    const k = key(state.userId, state.date);
    const existing = db.sessions.get(k);
    if (existing) return structuredClone(existing);
    db.sessions.set(k, structuredClone(state));
    return state;
  },
  async saveSession(state, prevVersion) {
    const k = key(state.userId, state.date);
    const cur = db.sessions.get(k);
    if (!cur || cur.version !== prevVersion) return false;
    db.sessions.set(k, structuredClone(state));
    return true;
  },
  async getStanding(userId, date) {
    const rows = rankRows("daily", date);
    const me = rows.find((r) => r.userId === userId);
    if (!me) return null;
    const mine = finished().filter((f) => f.userId === userId);
    return {
      rank: me.rank,
      totalPlayers: rows.length,
      beatenPct: rows.length > 1 ? (rows.length - me.rank) / (rows.length - 1) : 1,
      personalBest: Math.max(...mine.map((f) => f.score)),
    };
  },
  async getLeaderboard(period, date, userId, limit, offset): Promise<LeaderboardPage> {
    const rows = rankRows(period, date);
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      me: (userId && rows.find((r) => r.userId === userId)) || null,
      topScore: rows[0]?.score ?? null,
    };
  },
  async getProfile(userId, today) {
    const mine = finished()
      .filter((f) => f.userId === userId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const { current, longest } = streaks(mine.map((f) => f.date), today);
    return {
      username: name(userId),
      isGuest: true,
      email: null,
      currentStreak: current,
      longestStreak: longest,
      played: mine.length,
      averageScore: mine.length ? Math.round(mine.reduce((s, f) => s + f.score, 0) / mine.length) : 0,
      bestScore: mine.length ? Math.max(...mine.map((f) => f.score)) : 0,
      recent: mine.slice(0, 10).map((f) => ({ date: f.date, score: f.score, timeMs: f.timeMs, perfectRounds: f.perfectRounds })),
    };
  },
  async getAccount(userId) {
    return { username: name(userId), isGuest: true, email: null };
  },
  async setUsername(userId, username) {
    for (const [id, n] of db.usernames) {
      if (id !== userId && n.toLowerCase() === username.toLowerCase()) return { ok: false, error: "taken" };
    }
    db.usernames.set(userId, username);
    return { ok: true };
  },
  async getHomeStats(userId, date) {
    const players = [...db.sessions.values()].filter((s) => s.date === date).length;
    const top = rankRows("daily", date).slice(0, 5).map(({ rank, username, score }) => ({ rank, username, score }));
    const streak = userId
      ? streaks(finished().filter((f) => f.userId === userId).map((f) => f.date), date).current
      : 0;
    return { players, streak, top };
  },
};
