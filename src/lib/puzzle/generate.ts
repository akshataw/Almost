import { PUZZLE_VERSION } from "../config";
import { hslToHex, type Hsl } from "./color";
import { JITTER } from "./constants";
import { createRng, type Rng } from "./rng";
import { dailySeed } from "./seed";
import type {
  DailyChallenge,
  Difficulty,
  GeneratedRound,
  PuzzleType,
  Shape,
  ShapeKind,
} from "./types";
import { validateRound } from "./validate";

export const CELL = 60;

/** Daily format: difficulty rises through the five rounds. */
export const DAILY_FORMAT: { type: PuzzleType; difficulty: Difficulty; grid: number }[] = [
  { type: "size", difficulty: 1, grid: 5 },
  { type: "color", difficulty: 1, grid: 5 },
  { type: "rotation", difficulty: 2, grid: 6 },
  { type: "size-rotation", difficulty: 2, grid: 6 },
  { type: "combined", difficulty: 3, grid: 7 },
];

export const TIME_LIMIT_MS: Record<Difficulty, number> = { 1: 20_000, 2: 25_000, 3: 30_000 };

/** [min, max] magnitude of the anomaly per difficulty. */
const SIZE_DELTA: Record<Difficulty, [number, number]> = { 1: [0.16, 0.2], 2: [0.1, 0.13], 3: [0.07, 0.09] };
const ROT_DELTA: Record<Difficulty, [number, number]> = { 1: [18, 22], 2: [11, 14], 3: [8, 10] };
const LIGHT_DELTA: Record<Difficulty, [number, number]> = { 1: [10, 12], 2: [7, 8], 3: [5, 6] };

const INSTRUCTIONS: Record<PuzzleType, string> = {
  size: "One of these is not quite the same size.",
  color: "One of these is a slightly different shade.",
  rotation: "One of these has turned.",
  "size-rotation": "One of these has grown or shrunk — and turned.",
  combined: "Something about one of these is off.",
};

/** Poster-like palettes: canvas background + base hue range for shapes. */
const PALETTES: { background: string; fill: Hsl }[] = [
  { background: "#f2f0e9", fill: { h: 225, s: 12, l: 16 } }, // ink on paper
  { background: "#1a1d24", fill: { h: 48, s: 18, l: 92 } }, // paper on ink
  { background: "#1a1d24", fill: { h: 39, s: 62, l: 58 } }, // signal on ink
  { background: "#f2f0e9", fill: { h: 226, s: 56, l: 64 } }, // anomaly on paper
  { background: "#1a1d24", fill: { h: 226, s: 56, l: 64 } }, // anomaly on ink
  { background: "#f2f0e9", fill: { h: 12, s: 55, l: 52 } }, // terracotta on paper
  { background: "#1a1d24", fill: { h: 140, s: 14, l: 62 } }, // sage on ink
];

const ROTATION_KINDS: ShapeKind[] = ["wedge", "half", "ell", "bar"];
const SIZE_KINDS: ShapeKind[] = ["circle", "square", "wedge", "half"];

export function generateRound(seed: string, round: number): GeneratedRound {
  const format = DAILY_FORMAT[round - 1];
  if (!format) throw new Error(`No round ${round}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = createRng(`${seed}-r${round}${attempt ? `-t${attempt}` : ""}`);
    const generated = buildRound(rng, round, format.type, format.difficulty, format.grid);
    if (validateRound(generated).ok) return generated;
  }
  throw new Error(`Could not generate a valid puzzle for ${seed} round ${round}`);
}

/** All five rounds for a date. Pass the secret for real puzzles (see seed.ts). */
export function generateDaily(date: string, version = PUZZLE_VERSION, secret?: string): DailyChallenge {
  const seed = dailySeed(date, version, secret ?? process.env.PUZZLE_SECRET);
  const rounds = DAILY_FORMAT.map((_, i) => generateRound(seed, i + 1));
  return {
    date,
    version,
    seed,
    puzzles: rounds.map((r) => r.puzzle),
    answers: rounds.map((r) => r.answerIndex),
  };
}

function buildRound(
  rng: Rng,
  round: number,
  type: PuzzleType,
  difficulty: Difficulty,
  grid: number,
): GeneratedRound {
  const palette = rng.pick(PALETTES);
  // keep color rounds in a mid lightness band so ± shifts stay visible both ways
  const baseHsl: Hsl =
    type === "color" || type === "combined"
      ? { ...palette.fill, l: Math.min(68, Math.max(38, palette.fill.l)), s: Math.max(palette.fill.s, 35) }
      : palette.fill;

  const kinds = type === "size" || type === "color" ? SIZE_KINDS : ROTATION_KINDS;
  const kind = type === "color" ? rng.pick(["circle", "square"] as const) : rng.pick(kinds);
  const baseSize = CELL * rng.range(0.28, 0.32);
  const baseRotation = kind === "circle" ? 0 : rng.pick([0, 15, 30, 45, 90, 135, 180, 270]);

  // keep the anomaly off the outer ring for harder rounds
  const margin = difficulty >= 2 ? 1 : 0;
  const ac = rng.int(margin, grid - 1 - margin);
  const ar = rng.int(margin, grid - 1 - margin);
  const answerIndex = ar * grid + ac;

  // how the anomaly differs from the rest
  let sizeFactor = 1;
  let rotDelta = 0;
  let lightDelta = 0;
  const changeSize = () => (sizeFactor = 1 + rng.sign() * rng.range(...SIZE_DELTA[difficulty]));
  const changeRotation = () => (rotDelta = rng.sign() * Math.round(rng.range(...ROT_DELTA[difficulty])));
  const changeColor = () => (lightDelta = rng.sign() * rng.range(...LIGHT_DELTA[difficulty]));

  switch (type) {
    case "size":
      changeSize();
      break;
    case "color":
      changeColor();
      break;
    case "rotation":
      changeRotation();
      break;
    case "size-rotation":
      changeSize();
      changeRotation();
      break;
    case "combined": {
      const pairs = [
        [changeSize, changeColor],
        [changeRotation, changeColor],
        [changeSize, changeRotation],
      ] as const;
      for (const change of rng.pick(pairs)) change();
      break;
    }
  }

  // Every shape gets a tiny, imperceptible jitter so the anomaly can't be found by comparing
  // exact attribute values in the puzzle data. Jitter stays far below the smallest real anomaly.
  const shapes: Shape[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const isAnomaly = r * grid + c === answerIndex;
      const jSize = 1 + rng.range(-JITTER.size, JITTER.size);
      const jRot = kind === "circle" ? 0 : rng.range(-JITTER.rotation, JITTER.rotation);
      const jLight = rng.range(-JITTER.lightness, JITTER.lightness);
      // hue/saturation noise spreads the 8-bit colours so that the anomaly isn't the only unique hex value
      const jHue = rng.range(-JITTER.hue, JITTER.hue);
      const jSat = rng.range(-JITTER.saturation, JITTER.saturation);
      shapes.push({
        kind,
        cx: CELL / 2 + c * CELL,
        cy: CELL / 2 + r * CELL,
        size: round3(baseSize * jSize * (isAnomaly ? sizeFactor : 1)),
        rotation: round2(baseRotation + jRot + (isAnomaly ? rotDelta : 0)),
        fill: hslToHex({
          h: (baseHsl.h + jHue + 360) % 360,
          s: Math.min(100, Math.max(0, baseHsl.s + jSat)),
          l: baseHsl.l + jLight + (isAnomaly ? lightDelta : 0),
        }),
      });
    }
  }

  return {
    puzzle: {
      round,
      type,
      difficulty,
      cols: grid,
      rows: grid,
      cell: CELL,
      background: palette.background,
      shapes,
      instruction: INSTRUCTIONS[type],
      timeLimitMs: TIME_LIMIT_MS[difficulty],
    },
    answerIndex,
  };
}

// enough precision that jittered values (almost) never repeat — repeats would single out the anomaly
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

