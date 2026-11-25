import { canvasPadding, type PuzzleSpec, type Shape } from "./types";

/** SVG markup for one shape centred on the origin (mirrors the old client glyphs). */
function glyph(shape: Shape): string {
  const s = shape.size;
  const f = shape.fill;
  switch (shape.kind) {
    case "circle":
      return `<circle r="${s}" fill="${f}"/>`;
    case "square":
      return `<rect x="${-s * 0.82}" y="${-s * 0.82}" width="${s * 1.64}" height="${s * 1.64}" fill="${f}"/>`;
    case "wedge":
      return `<polygon points="0,${-s} ${s * 0.62},${s * 0.82} ${-s * 0.62},${s * 0.82}" fill="${f}"/>`;
    case "half":
      return `<path d="M ${-s} ${s * 0.42} A ${s} ${s} 0 0 1 ${s} ${s * 0.42} Z" fill="${f}"/>`;
    case "ell": {
      const t = s * 0.55;
      return `<path d="M ${-s} ${-s} H ${-s + t} V ${s - t} H ${s} V ${s} H ${-s} Z" fill="${f}"/>`;
    }
    case "bar":
      return `<rect x="${-s}" y="${-s * 0.28}" width="${s * 2}" height="${s * 0.56}" fill="${f}"/>`;
  }
}

export function canvasSize(p: Pick<PuzzleSpec, "cols" | "rows" | "cell">) {
  const pad = canvasPadding(p.cell);
  return { pad, width: p.cols * p.cell + pad * 2, height: p.rows * p.cell + pad * 2 };
}

/** Full puzzle as an SVG document (rendered to PNG on the server; never sent as SVG). */
export function puzzleSvg(p: PuzzleSpec): string {
  const { pad, width, height } = canvasSize(p);
  const shapes = p.shapes
    .map((sh) => `<g transform="translate(${sh.cx} ${sh.cy}) rotate(${sh.rotation})">${glyph(sh)}</g>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${p.background}"/><g transform="translate(${pad} ${pad})">${shapes}</g></svg>`;
}
