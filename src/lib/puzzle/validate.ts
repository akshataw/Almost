import { hexLightness } from "./color";
import { JITTER } from "./constants";
import type { GeneratedRound, Shape } from "./types";

/** Minimum perceptible differences (anomaly vs. the typical element). Below these a puzzle is unfair. */
export const MIN_SIZE_RATIO = 0.05;
export const MIN_ROTATION_DEG = 6;
export const MIN_LIGHTNESS = 3.5;

/** Small tolerance for rounding (sizes to 0.001, rotation to 0.01°, colours to 8-bit hex). */
const EPS = { size: 0.001, rotation: 0.01, lightness: 0.4 };

export type Validation = { ok: true } | { ok: false; reason: string };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

type Deviation = { size: number; rotation: number; lightness: number };

function deviations(shapes: Shape[]): Deviation[] {
  const mSize = median(shapes.map((s) => s.size));
  const mRot = median(shapes.map((s) => s.rotation));
  const mLight = median(shapes.map((s) => hexLightness(s.fill)));
  return shapes.map((s) => ({
    size: Math.abs(s.size / mSize - 1),
    rotation: Math.abs(s.rotation - mRot),
    lightness: Math.abs(hexLightness(s.fill) - mLight),
  }));
}

/**
 * A fair puzzle: every element except the anomaly stays within the imperceptible jitter band,
 * and the anomaly differs clearly (above the minimums) in each attribute it changes.
 */
export function validateRound({ puzzle, answerIndex }: GeneratedRound): Validation {
  const { shapes, cols, rows, cell } = puzzle;
  if (shapes.length !== cols * rows) return { ok: false, reason: "shape count mismatch" };
  if (answerIndex < 0 || answerIndex >= shapes.length) return { ok: false, reason: "answer out of range" };
  if (new Set(shapes.map((s) => s.kind)).size !== 1) return { ok: false, reason: "mixed shape kinds" };

  const dev = deviations(shapes);
  // jitter is ± around the base, so two elements can sit up to 2× apart; allow that against the median
  const band = { size: 2 * JITTER.size + EPS.size, rotation: 2 * JITTER.rotation + EPS.rotation, lightness: 2 * JITTER.lightness + EPS.lightness };

  for (let i = 0; i < shapes.length; i++) {
    if (i === answerIndex) continue;
    const d = dev[i];
    if (d.size > band.size || d.rotation > band.rotation || d.lightness > band.lightness) {
      return { ok: false, reason: `element ${i} stands out too (ambiguous)` };
    }
  }

  const a = dev[answerIndex];
  const anomaly = shapes[answerIndex];
  const changed = {
    size: a.size > band.size,
    rotation: a.rotation > band.rotation,
    lightness: a.lightness > band.lightness,
  };
  if (!changed.size && !changed.rotation && !changed.lightness) return { ok: false, reason: "no visible anomaly" };
  if (changed.size && a.size < MIN_SIZE_RATIO) return { ok: false, reason: "size anomaly too subtle" };
  if (changed.rotation && a.rotation < MIN_ROTATION_DEG) return { ok: false, reason: "rotation anomaly too subtle" };
  if (changed.lightness && a.lightness < MIN_LIGHTNESS) return { ok: false, reason: "colour anomaly too subtle" };
  if (anomaly.kind === "circle" && changed.rotation) return { ok: false, reason: "rotated circle" };
  if (anomaly.size > cell * 0.45) return { ok: false, reason: "anomaly overflows cell" };

  // The puzzle data must not give the answer away: no exact value (or combination) may be unique
  // to the anomaly alone. Otherwise reading the JSON would beat looking at the picture.
  const keys: ((s: Shape) => string | number)[] = [(s) => s.size, (s) => s.rotation, (s) => s.fill, (s) => `${s.size}|${s.rotation}|${s.fill}`];
  for (const key of keys) {
    const vals = shapes.map(key);
    const counts = new Map<string | number, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    const solos = vals.flatMap((v, i) => (counts.get(v) === 1 ? [i] : []));
    if (solos.length === 1 && solos[0] === answerIndex) return { ok: false, reason: "anomaly identifiable from exact values" };
  }

  return { ok: true };
}
