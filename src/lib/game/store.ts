import type { DailyChallenge } from "../puzzle/types";
import type { SessionState } from "./session";

export type Standing = {
  rank: number;
  totalPlayers: number;
  /** share of other finishers with a strictly worse ranking, 0..1 */
  beatenPct: number;
  personalBest: number;
};

export type LeaderboardPeriod = "daily" | "weekly" | "alltime";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  score: number;
  days?: number;
  timeMs?: number;
};

export type LeaderboardPage = {
  rows: LeaderboardRow[];
  total: number;
  me: LeaderboardRow | null;
  topScore: number | null;
};

export type Account = {
  username: string;
  /** true = anonymous guest account (no email yet) */
  isGuest: boolean;
  email: string | null;
};

export type ProfileStats = {
  username: string;
  isGuest: boolean;
  email: string | null;
  currentStreak: number;
  longestStreak: number;
  played: number;
  averageScore: number;
  bestScore: number;
  recent: { date: string; score: number; timeMs: number; perfectRounds: number }[];
};

export type HomeStats = {
  players: number;
  streak: number;
  top: { rank: number; username: string; score: number }[];
};

export interface GameStore {
  /** Official challenge for a date, including answers. Server only. */
  getChallenge(date: string): Promise<DailyChallenge>;
  getSession(userId: string, date: string): Promise<SessionState | null>;
  /** Creates the player's run for the date; returns the existing one if it already exists. */
  createSession(state: SessionState): Promise<SessionState>;
  /** Saves only if the stored version still equals prevVersion. */
  saveSession(state: SessionState, prevVersion: number): Promise<boolean>;
  getStanding(userId: string, date: string): Promise<Standing | null>;
  getLeaderboard(period: LeaderboardPeriod, date: string, userId: string | null, limit: number, offset: number): Promise<LeaderboardPage>;
  getProfile(userId: string, today: string): Promise<ProfileStats>;
  /** Lightweight "who am I" for the header. */
  getAccount(userId: string): Promise<Account>;
  setUsername(userId: string, username: string): Promise<{ ok: true } | { ok: false; error: string }>;
  getHomeStats(userId: string | null, date: string): Promise<HomeStats>;
}
