"use client";

import { ATTEMPTS_PER_ROUND } from "@/lib/config";
import { formatDuration, formatExperiment } from "@/lib/date";
import type { SessionView } from "@/lib/game/view";

export function RoundProgress({ view }: { view: SessionView }) {
  return (
    <div className="flex items-center justify-between">
      <span className="label whitespace-nowrap">
        Exp<span className="hidden sm:inline">eriment</span> <span className="text-signal">{formatExperiment(view.experiment)}</span>
      </span>
      <div className="flex items-center gap-3">
        <span className="label whitespace-nowrap">
          <span className="hidden sm:inline">Round </span>
          {Math.min(view.currentRound, view.rounds.length)}
          <span className="hidden sm:inline"> of </span>
          <span className="sm:hidden">/</span>
          {view.rounds.length}
        </span>
        <div className="flex gap-1.5" aria-hidden>
          {view.rounds.map((r) => (
            <span
              key={r.round}
              className={`h-1.5 w-4 transition-colors ${
                r.done ? (r.correct ? "bg-signal" : "bg-anomaly/60") : r.round === view.currentRound ? "bg-paper" : "bg-ink-3"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RoundFooter({ elapsedMs, attemptsLeft }: { elapsedMs: number; attemptsLeft: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="label">Time</div>
        <div className="font-mono text-2xl tabular-nums">{formatDuration(elapsedMs)}</div>
      </div>
      <div className="text-right">
        <div className="label">Attempts</div>
        <div className="mt-2 flex justify-end gap-1.5" aria-label={`${attemptsLeft} attempts left`}>
          {Array.from({ length: ATTEMPTS_PER_ROUND }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 border transition-colors ${i < attemptsLeft ? "border-paper bg-paper" : "border-paper-faint"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
