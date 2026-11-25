"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { canvasPadding, type PublicPuzzle } from "@/lib/puzzle/types";

export type CanvasState = {
  /** indices the player tapped that were wrong */
  wrong: number[];
  /** index of the most recent wrong tap, with a counter so repeat animations retrigger */
  lastWrong: { index: number; n: number } | null;
  /** index of the anomaly once the round is over (found or exhausted) */
  revealed: number | null;
  outcome: "found" | "missed" | null;
  pending: number | null;
};

type Props = {
  puzzle: PublicPuzzle;
  /** server-rendered picture of the round (the browser never receives the shapes themselves) */
  imageUrl: string;
  state: CanvasState;
  disabled?: boolean;
  onSelect: (index: number) => void;
  /** fires once the picture is visible — the display timer starts then */
  onShown?: () => void;
};

export function PuzzleCanvas({ puzzle, imageUrl, state, disabled, onSelect, onShown }: Props) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === imageUrl;

  const { cols, rows, cell, background } = puzzle;
  const pad = canvasPadding(cell);
  const w = cols * cell + pad * 2;
  const h = rows * cell + pad * 2;
  const isLight = background.toLowerCase() === "#f2f0e9";
  const ringWrong = isLight ? "#111318" : "#f2f0e9";
  const distortKey = state.lastWrong ? state.lastWrong.n : 0;

  const cellBox = (i: number) => {
    const x = pad + (i % cols) * cell;
    const y = pad + Math.floor(i / cols) * cell;
    return { x, y, cx: x + cell / 2, cy: y + cell / 2 };
  };

  // cells that need a clipped copy of the picture for a per-element effect
  const special = new Set<number>([...state.wrong]);
  if (state.pending !== null) special.add(state.pending);
  if (state.revealed !== null) special.add(state.revealed);
  if (state.lastWrong) special.add(state.lastWrong.index);

  const image = <image href={imageUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />;

  return (
    <motion.svg
      viewBox={`0 0 ${w} ${h}`}
      className="block h-auto w-full touch-manipulation select-none"
      role="group"
      aria-label={`Pattern ${puzzle.round}: ${cols} by ${rows} grid`}
      initial={false}
      animate={{ opacity: loaded ? 1 : 0.35 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <defs>
        <filter id={`${uid}-distort`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={distortKey} />
          <motion.feDisplacementMap
            key={distortKey}
            in="SourceGraphic"
            initial={{ scale: distortKey && !reduce ? 14 : 0 }}
            animate={{ scale: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </filter>
        {[...special].map((i) => {
          const b = cellBox(i);
          return (
            <clipPath key={i} id={`${uid}-c${i}`}>
              <rect x={b.x} y={b.y} width={cell} height={cell} />
            </clipPath>
          );
        })}
      </defs>

      <rect width={w} height={h} fill={background} />
      <g filter={`url(#${uid}-distort)`}>
        <image
          key={imageUrl}
          href={imageUrl}
          x={0}
          y={0}
          width={w}
          height={h}
          preserveAspectRatio="none"
          onLoad={() => {
            setLoadedUrl(imageUrl);
            onShown?.();
          }}
        />

        {[...special].map((i) => {
          const b = cellBox(i);
          const wrong = state.wrong.includes(i);
          const shaking = state.lastWrong?.index === i;
          const revealed = state.revealed === i;
          const pending = state.pending === i;
          const anim = shaking
            ? "almost-shake"
            : revealed
              ? "almost-pulse"
              : pending
                ? "almost-press"
                : "";
          return (
            <g key={`${i}-${shaking ? state.lastWrong!.n : 0}-${revealed ? 1 : 0}`} clipPath={`url(#${uid}-c${i})`} pointerEvents="none">
              <rect x={b.x} y={b.y} width={cell} height={cell} fill={background} />
              <g className={anim} style={{ transformBox: "view-box", transformOrigin: `${b.cx}px ${b.cy}px` }}>
                {image}
              </g>
              {wrong && !revealed && <rect x={b.x} y={b.y} width={cell} height={cell} fill={background} opacity={0.62} />}
            </g>
          );
        })}
      </g>

      {/* rings sit outside the clip so they can extend to the cell edge */}
      {state.wrong.map((i) => {
        if (state.revealed === i) return null;
        const b = cellBox(i);
        return (
          <circle key={`ring-${i}`} cx={b.cx} cy={b.cy} r={cell * 0.44} fill="none" stroke={ringWrong} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 4" pointerEvents="none" />
        );
      })}
      {state.revealed !== null && (
        <motion.circle
          cx={cellBox(state.revealed).cx}
          cy={cellBox(state.revealed).cy}
          r={cell * 0.46}
          fill="none"
          stroke={state.outcome === "found" ? "#d8a94f" : "#7189d9"}
          strokeWidth={2.5}
          pointerEvents="none"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      )}

      {/* tap targets: one per cell */}
      {Array.from({ length: cols * rows }, (_, i) => {
        const b = cellBox(i);
        const off = disabled || !loaded || state.wrong.includes(i);
        return (
          <rect
            key={`hit-${i}`}
            x={b.x}
            y={b.y}
            width={cell}
            height={cell}
            fill="transparent"
            stroke="transparent"
            strokeWidth={1.5}
            role="button"
            aria-label={`Element ${i + 1}`}
            aria-disabled={off}
            tabIndex={off ? -1 : 0}
            style={{ cursor: off ? "default" : "pointer", outline: "none" }}
            className="focus-visible:stroke-signal"
            onClick={off ? undefined : () => onSelect(i)}
            onKeyDown={(e) => {
              if (!off && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelect(i);
              }
            }}
          />
        );
      })}
    </motion.svg>
  );
}
