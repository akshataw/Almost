export const CORRECT_POINTS = 100;
export const FIRST_ATTEMPT_BONUS = 25;
export const SECOND_ATTEMPT_BONUS = 10;
export const MAX_SPEED_BONUS = 25;

/** B = 25 × max(0, 1 − t/T), rounded up to a whole point (so a near-instant find earns the full 25). */
export function speedBonus(timeMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return 0;
  return Math.ceil(MAX_SPEED_BONUS * Math.max(0, 1 - Math.max(0, timeMs) / timeLimitMs));
}

export function attemptBonus(attempts: number): number {
  if (attempts === 1) return FIRST_ATTEMPT_BONUS;
  if (attempts === 2) return SECOND_ATTEMPT_BONUS;
  return 0;
}

export function roundScore(r: { correct: boolean; attempts: number; timeMs: number; timeLimitMs: number }): number {
  if (!r.correct) return 0;
  return CORRECT_POINTS + attemptBonus(r.attempts) + speedBonus(r.timeMs, r.timeLimitMs);
}
