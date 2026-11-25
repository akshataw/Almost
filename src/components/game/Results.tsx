"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { MAX_DAILY_SCORE } from "@/lib/config";
import { formatDuration } from "@/lib/date";
import type { SessionView } from "@/lib/game/view";
import { shareText, verdict } from "@/lib/share";
import { useAccount } from "@/hooks/useAccount";

export function Results({ view }: { view: SessionView }) {
  const s = view.summary!;
  const st = s.standing;
  const [copied, setCopied] = useState(false);
  const account = useAccount();

  const text = shareText({
    experiment: view.experiment,
    score: s.totalScore,
    perfectRounds: s.perfectRounds,
    timeMs: s.completionTimeMs,
    rounds: view.rounds,
  });

  async function cardFile(): Promise<File | null> {
    try {
      const res = await fetch(`/api/card?date=${view.date}`);
      if (!res.ok) return null;
      return new File([await res.blob()], `almost-${view.experiment}.png`, { type: "image/png" });
    } catch {
      return null;
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        const file = await cardFile();
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ text, files: [file] });
        } else {
          await navigator.share({ text });
        }
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your result", text);
    }
  }

  const stats = [
    { label: "Completion time", value: formatDuration(s.completionTimeMs) },
    { label: "Perfect rounds", value: `${s.perfectRounds}/${s.rounds.length}` },
    { label: "Accuracy", value: `${Math.round(s.accuracy * 100)}%` },
    { label: "Daily position", value: st ? `#${st.rank}` : "—" },
    { label: "Players beaten", value: st ? `${Math.round(st.beatenPct * 100)}%` : "—" },
    { label: "Personal best", value: st ? String(st.personalBest) : "—" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-10 pt-4 sm:pt-10">
      <div className="space-y-4">
        <p className="label">Today&apos;s experiment complete</p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="font-mono text-6xl tracking-tight sm:text-8xl"
        >
          {s.totalScore}
          <span className="text-paper-faint"> / {MAX_DAILY_SCORE}</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="font-display text-2xl text-paper-dim"
        >
          {verdict(s.totalScore)}
        </motion.p>
      </div>

      {s.flagged && (
        <p className="border border-anomaly/40 p-3 text-sm text-paper-dim">
          This run was faster than we think a person can play, so it isn&apos;t on today&apos;s leaderboard.
        </p>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-ink-3 bg-ink-3 sm:grid-cols-3">
        {stats.map((x, i) => (
          <motion.div
            key={x.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.08 }}
            className="bg-ink p-4"
          >
            <div className="font-mono text-3xl">{x.value}</div>
            <div className="label mt-1">{x.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2" aria-label="Round breakdown">
        {s.rounds.map((r) => (
          <div key={r.round} className="flex-1 border border-ink-3 p-2 text-center">
            <div className={`font-mono text-lg ${r.correct ? "text-signal" : "text-paper-faint"}`}>{r.score}</div>
            <div className="label">R{r.round}</div>
          </div>
        ))}
      </div>

      {account?.isGuest && (
        <div className="flex flex-col gap-3 border border-signal/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg">Save your streak.</p>
            <p className="text-sm text-paper-dim">
              You&apos;re playing as {account.username}. Log in with your email to keep today&apos;s score on every device.
            </p>
          </div>
          <Link
            href="/login"
            className="shrink-0 border border-signal px-5 py-3 text-center font-mono text-xs tracking-[0.2em] text-signal uppercase hover:bg-signal hover:text-ink"
          >
            Log in
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={share}
          className="bg-paper px-6 py-4 font-mono text-sm tracking-[0.2em] text-ink uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {copied ? "Copied to clipboard" : "Share your result"}
        </button>
        <a
          href={`/api/card?date=${view.date}`}
          download={`almost-${view.experiment}.png`}
          className="border border-ink-3 px-6 py-4 text-center font-mono text-sm tracking-[0.2em] uppercase hover:border-paper-dim"
        >
          Save card
        </a>
        <Link href="/leaderboard" className="border border-ink-3 px-6 py-4 text-center font-mono text-sm tracking-[0.2em] uppercase hover:border-paper-dim">
          Leaderboard
        </Link>
        <Link href="/profile" className="border border-ink-3 px-6 py-4 text-center font-mono text-sm tracking-[0.2em] uppercase hover:border-paper-dim">
          Profile
        </Link>
      </div>
      <p className="text-sm text-paper-faint">A new experiment appears at 00:00 UTC.</p>
    </div>
  );
}
