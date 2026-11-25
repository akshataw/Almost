import { describe, expect, it } from "vitest";
import { roundScore, speedBonus } from "./scoring";

describe("scoring", () => {
  it("speed bonus follows 25 × max(0, 1 − t/T)", () => {
    expect(speedBonus(0, 20_000)).toBe(25);
    expect(speedBonus(10_000, 20_000)).toBe(13); // 12.5 rounds up
    expect(speedBonus(500, 20_000)).toBe(25); // 24.4 rounds up
    expect(speedBonus(19_999, 20_000)).toBe(1);
    expect(speedBonus(20_000, 20_000)).toBe(0);
    expect(speedBonus(60_000, 20_000)).toBe(0);
    expect(speedBonus(-5, 20_000)).toBe(25);
  });

  it.each([
    [{ correct: true, attempts: 1, timeMs: 0 }, 150],
    [{ correct: true, attempts: 2, timeMs: 0 }, 135],
    [{ correct: true, attempts: 3, timeMs: 0 }, 125],
    [{ correct: true, attempts: 1, timeMs: 99_000 }, 125],
    [{ correct: true, attempts: 3, timeMs: 99_000 }, 100],
    [{ correct: false, attempts: 3, timeMs: 0 }, 0],
  ])("%o → %i", (r, expected) => {
    expect(roundScore({ ...r, timeLimitMs: 20_000 })).toBe(expected);
  });
});
