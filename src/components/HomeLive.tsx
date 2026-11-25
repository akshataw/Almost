"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROUNDS_PER_DAY } from "@/lib/config";
import { experimentNumber, formatExperiment } from "@/lib/date";
import { useToday } from "@/hooks/useToday";

type HomeStats = {
  players: number;
  streak: number;
  top: { rank: number; username: string; score: number }[];
};

export function ExperimentNumber() {
  const today = useToday();
  return <span>{today === null ? "···" : formatExperiment(experimentNumber(today))}</span>;
}

export function HomeStatsPanel() {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/home")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setStats(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const dash = "—";
  return (
    <div className="grid gap-px overflow-hidden rounded-sm border border-ink-3 bg-ink-3 sm:grid-cols-[1fr_1fr_2fr]">
      <Stat label="Players today" value={stats ? stats.players.toLocaleString() : dash} />
      <Stat label="Your streak" value={stats ? `${stats.streak}d` : dash} />
      <div className="bg-ink p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Today&apos;s top observers</span>
          <Link href="/leaderboard" className="label hover:text-paper">
            All →
          </Link>
        </div>
        {stats && stats.top.length > 0 ? (
          <ol className="space-y-1.5 font-mono text-sm">
            {stats.top.slice(0, 3).map((p) => (
              <li key={p.rank} className="flex justify-between gap-4">
                <span className="truncate">
                  <span className="text-paper-faint">{String(p.rank).padStart(2, "0")}</span>{" "}
                  {p.username}
                </span>
                <span className="text-signal">{p.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-paper-dim">No one has finished today&apos;s experiment yet.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink p-4">
      <div className="label">{label}</div>
      <div className="mt-2 font-mono text-2xl">{value}</div>
    </div>
  );
}

export function RoundDots() {
  return (
    <div className="flex items-center gap-2" aria-label={`${ROUNDS_PER_DAY} puzzles today`}>
      {Array.from({ length: ROUNDS_PER_DAY }, (_, i) => (
        <span key={i} className="h-2 w-2 rounded-full border border-paper-dim" />
      ))}
      <span className="label ml-2">{ROUNDS_PER_DAY} patterns</span>
    </div>
  );
}
