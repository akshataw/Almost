export type ShapeKind = "circle" | "square" | "wedge" | "half" | "ell" | "bar";

export type Shape = {
  kind: ShapeKind;
  cx: number;
  cy: number;
  /** bounding radius in canvas units */
  size: number;
  /** degrees */
  rotation: number;
  /** hex color */
  fill: string;
};

export type PuzzleType = "size" | "color" | "rotation" | "size-rotation" | "combined";
export type Difficulty = 1 | 2 | 3;

/** Full puzzle definition. Server only: the shapes would let a script find the anomaly. */
export type PuzzleSpec = {
  round: number; // 1-based
  type: PuzzleType;
  difficulty: Difficulty;
  cols: number;
  rows: number;
  cell: number;
  background: string;
  shapes: Shape[];
  instruction: string;
  timeLimitMs: number;
};

/** What the browser gets: layout only. The picture itself is a server-rendered image. */
export type PublicPuzzle = Omit<PuzzleSpec, "shapes">;

export function toPublicPuzzle(spec: PuzzleSpec): PublicPuzzle {
  // explicit field list so nothing new leaks by accident
  const { round, type, difficulty, cols, rows, cell, background, instruction, timeLimitMs } = spec;
  return { round, type, difficulty, cols, rows, cell, background, instruction, timeLimitMs };
}

/** Canvas padding around the grid, in canvas units (shared by the image renderer and tap targets). */
export function canvasPadding(cell: number): number {
  return cell * 0.35;
}

export type GeneratedRound = { puzzle: PuzzleSpec; answerIndex: number };

export type DailyChallenge = {
  /** database id, when stored */
  id?: string;
  date: string;
  version: number;
  seed: string;
  puzzles: PuzzleSpec[];
  /** answers[i] is the anomaly index for puzzles[i] — server only */
  answers: number[];
};
