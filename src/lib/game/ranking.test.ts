import { describe, expect, it } from "vitest";
import { aggregate, bestPerUserDate, compareAggregate, compareDaily, streaks, type Finished } from "./ranking";

const f = (o: Partial<Finished>): Finished => ({
  userId: "u",
  date: "2026-11-24",
  score: 500,
  accuracy: 1,
  timeMs: 60_000,
  completedAt: 0,
  perfectRounds: 0,
  ...o,
});

describe("daily ranking tie-breaks", () => {
  it("orders by score, then accuracy, then time, then earlier completion", () => {
    const rows = [
      f({ userId: "late", completedAt: 2 }),
      f({ userId: "slow", timeMs: 90_000 }),
      f({ userId: "early", completedAt: 1 }),
      f({ userId: "inaccurate", accuracy: 0.8 }),
      f({ userId: "top", score: 700 }),
    ].sort(compareDaily);
    expect(rows.map((r) => r.userId)).toEqual(["top", "early", "late", "slow", "inaccurate"]);
  });

  it("keeps only the best run per player per date", () => {
    const best = bestPerUserDate([
      f({ userId: "a", score: 300 }),
      f({ userId: "a", score: 600 }),
      f({ userId: "a", score: 450, date: "2026-11-25" }),
      f({ userId: "b", score: 100 }),
    ]);
    expect(best).toHaveLength(3);
    expect(best.find((r) => r.userId === "a" && r.date === "2026-11-24")?.score).toBe(600);
  });
});

describe("streaks", () => {
  it("counts a live streak through today or yesterday", () => {
    expect(streaks(["2026-11-22", "2026-11-23", "2026-11-24"], "2026-11-24")).toEqual({ current: 3, longest: 3 });
    expect(streaks(["2026-11-22", "2026-11-23"], "2026-11-24")).toEqual({ current: 2, longest: 2 });
  });

  it("resets after a missed day but remembers the longest", () => {
    expect(streaks(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-20"], "2026-11-24")).toEqual({ current: 0, longest: 3 });
  });

  it("handles month boundaries and duplicates", () => {
    expect(streaks(["2026-11-30", "2026-12-01", "2026-12-01"], "2026-12-01")).toEqual({ current: 2, longest: 2 });
  });
});

describe("weekly / all-time aggregation", () => {
  it("sums daily bests and breaks ties like the SQL ranking", () => {
    const rows = [
      f({ userId: "a", date: "2026-11-23", score: 600, accuracy: 1, timeMs: 50_000, completedAt: 1 }),
      f({ userId: "a", date: "2026-11-24", score: 600, accuracy: 0.8, timeMs: 50_000, completedAt: 5 }),
      f({ userId: "b", date: "2026-11-24", score: 1200, accuracy: 1, timeMs: 90_000, completedAt: 2 }),
      f({ userId: "c", date: "2026-11-24", score: 1200, accuracy: 1, timeMs: 90_000, completedAt: 3 }),
      f({ userId: "d", date: "2026-11-24", score: 1300, accuracy: 0.2, timeMs: 999_000, completedAt: 9 }),
    ];
    const agg = aggregate(rows);
    expect(agg.get("a")).toMatchObject({ score: 1200, days: 2, accuracy: 0.9, timeMs: 100_000, lastCompleted: 5 });
    const order = [...agg.entries()].sort(([, x], [, y]) => compareAggregate(x, y)).map(([id]) => id);
    // d: highest score; b and c tie except c finished later; a has lower average accuracy
    expect(order).toEqual(["d", "b", "c", "a"]);
  });
});
