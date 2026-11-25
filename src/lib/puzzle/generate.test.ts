import { describe, expect, it } from "vitest";
import { addDays } from "../date";
import { hexLightness } from "./color";
import { DAILY_FORMAT, generateDaily } from "./generate";
import { validateRound } from "./validate";

const START = "2026-11-20";
const DATES = Array.from({ length: 365 }, (_, i) => addDays(START, i));

describe("puzzle generation", () => {
  it("is deterministic for the same date and version", () => {
    for (const d of DATES.slice(0, 60)) {
      expect(generateDaily(d)).toEqual(generateDaily(d));
    }
  });

  it("differs between days and versions", () => {
    const a = generateDaily("2026-11-20", 3);
    expect(generateDaily("2026-11-21", 3)).not.toEqual(a);
    expect(generateDaily("2026-11-20", 4)).not.toEqual(a);
  });

  it("produces 5 valid rounds following the daily format for a year of dates", () => {
    for (const d of DATES) {
      const c = generateDaily(d);
      expect(c.puzzles).toHaveLength(5);
      c.puzzles.forEach((p, i) => {
        expect(p.type).toBe(DAILY_FORMAT[i].type);
        expect(p.cols).toBe(DAILY_FORMAT[i].grid);
        expect(validateRound({ puzzle: p, answerIndex: c.answers[i] })).toEqual({ ok: true });
      });
    }
  });

  it("never puts the answer in the public puzzle data", () => {
    const c = generateDaily(START);
    for (const p of c.puzzles) {
      expect(JSON.stringify(p)).not.toMatch(/answer/i);
    }
  });

  it("gets harder: anomaly deltas shrink from easy to hard", () => {
    const easy: number[] = [];
    const medium: number[] = [];
    for (const d of DATES) {
      const c = generateDaily(d);
      easy.push(sizeDeviation(c.puzzles[0].shapes, c.answers[0]));
      medium.push(sizeDeviation(c.puzzles[3].shapes, c.answers[3]));
    }
    expect(Math.min(...easy)).toBeGreaterThan(Math.max(...medium));
  });

  it("colour anomalies are visible but subtle", () => {
    for (const d of DATES) {
      const c = generateDaily(d);
      const { shapes } = c.puzzles[1];
      const others = shapes.filter((_, i) => i !== c.answers[1]).map((s) => hexLightness(s.fill));
      const typical = others.sort((a, b) => a - b)[others.length >> 1];
      const diff = Math.abs(hexLightness(shapes[c.answers[1]].fill) - typical);
      expect(diff).toBeGreaterThan(3.5);
      expect(diff).toBeLessThan(15);
    }
  });

  it("the answer cannot be found by comparing exact attribute values", () => {
    for (const d of DATES) {
      const c = generateDaily(d);
      c.puzzles.forEach((p, round) => {
        const key = (s: (typeof p.shapes)[number]) => `${s.size}|${s.rotation}|${s.fill}`;
        const counts = new Map<string, number>();
        p.shapes.forEach((s) => counts.set(key(s), (counts.get(key(s)) ?? 0) + 1));
        const unique = p.shapes.filter((s) => counts.get(key(s)) === 1).length;
        // the anomaly is not the only unique element: most elements are unique
        expect(unique, `${d} round ${round + 1}`).toBeGreaterThan(p.shapes.length / 2);
        // and no single attribute isolates it: if exactly one element has a one-off value, it isn't the anomaly
        for (const attr of ["size", "rotation", "fill"] as const) {
          const vals = p.shapes.map((s) => s[attr]);
          const solos = vals.map((v, i) => (vals.indexOf(v) === vals.lastIndexOf(v) ? i : -1)).filter((i) => i >= 0);
          if (solos.length === 1) expect(solos[0], `${d} r${round + 1} ${attr}`).not.toBe(c.answers[round]);
        }
      });
    }
  });
});

function sizeDeviation(shapes: { size: number }[], answer: number) {
  const others = shapes.filter((_, i) => i !== answer).map((s) => s.size).sort((a, b) => a - b);
  return Math.abs(shapes[answer].size / others[others.length >> 1] - 1);
}
