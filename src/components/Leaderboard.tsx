"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/date";

type Period = "daily" | "weekly" | "alltime";
type Row = { rank: number; username: string; score: number; days?: number; timeMs?: number; isMe: boolean };
type Data = { rows: Row[]; total: number; me: Row | null; topScore: number | null; nextOffset: number | null };

const TABS: { id: Period; label: string; note: string }[] = [
  { id: "daily", label: "Daily", note: "Resets at 00:00 UTC" },
  { id: "weekly", label: "Weekly", note: "Monday–Sunday UTC · sum of daily scores" },
  { id: "alltime", label: "All-time", note: "Every experiment since launch" },
];

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>("daily");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (p: Period, offset: number) => {
    const id = ++requestId.current; // responses from an older tab/page request are ignored
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/leaderboard?period=${p}&offset=${offset}`);
      if (!res.ok) throw new Error();
      const d: Data = await res.json();
      if (id !== requestId.current) return;
      setData((prev) => (offset > 0 && prev ? { ...d, rows: [...prev.rows, ...d.rows] } : d));
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => alive && load(period, 0));
    return () => {
      alive = false;
    };
  }, [period, load]);

  const tab = TABS.find((t) => t.id === period)!;
  const meVisible = data?.rows.some((r) => r.isMe);

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex border-b border-ink-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === period}
            onClick={() => {
              if (t.id !== period) {
                setData(null);
                setPeriod(t.id);
              }
            }}
            className={`-mb-px border-b-2 px-4 py-3 font-mono text-xs tracking-[0.2em] uppercase transition-colors ${
              t.id === period ? "border-signal text-paper" : "border-transparent text-paper-faint hover:text-paper-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-paper-dim">{tab.note}</p>
        <div className="flex gap-6 text-right">
          <div>
            <div className="label">Top score</div>
            <div className="font-mono text-xl text-signal">{data?.topScore ?? "—"}</div>
          </div>
          <div>
            <div className="label">Players</div>
            <div className="font-mono text-xl">{data ? data.total : "—"}</div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-paper-dim">
          Couldn&apos;t load rankings.{" "}
          <button className="underline" onClick={() => load(period, 0)}>
            Retry
          </button>
        </p>
      )}

      {data && data.rows.length === 0 && !loading && (
        <div className="border border-dashed border-ink-3 p-8 text-center text-paper-dim">
          Nobody has finished yet.{" "}
          <Link href="/play" className="text-signal">
            Be the first →
          </Link>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="label text-left">
              <th className="w-16 py-2 font-normal">Rank</th>
              <th className="py-2 font-normal">Player</th>
              {period !== "daily" && <th className="hidden py-2 text-right font-normal sm:table-cell">Days</th>}
              {period === "daily" && <th className="hidden py-2 text-right font-normal sm:table-cell">Time</th>}
              <th className="py-2 text-right font-normal">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <RowView key={`${r.rank}-${r.username}`} r={r} period={period} />
            ))}
            {!meVisible && data.me && (
              <>
                <tr aria-hidden>
                  <td colSpan={4} className="py-1 text-center text-paper-faint">
                    ⋯
                  </td>
                </tr>
                <RowView r={data.me} period={period} />
              </>
            )}
          </tbody>
        </table>
      )}

      {data?.nextOffset != null && (
        <button
          onClick={() => load(period, data.nextOffset!)}
          disabled={loading}
          className="w-full border border-ink-3 py-3 font-mono text-xs tracking-[0.2em] uppercase hover:border-paper-dim disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {!data && loading && <p className="label animate-pulse">Loading rankings…</p>}
    </div>
  );
}

function RowView({ r, period }: { r: Row; period: Period }) {
  return (
    <tr className={`border-t border-ink-3 ${r.isMe ? "bg-signal/10 text-signal" : ""}`}>
      <td className="py-3 pl-1 text-paper-faint">{String(r.rank).padStart(2, "0")}</td>
      <td className="max-w-0 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{r.username}</span>
          {r.isMe && <span className="shrink-0 text-[10px] tracking-widest uppercase">you</span>}
        </div>
      </td>
      {period !== "daily" && <td className="hidden py-3 text-right sm:table-cell">{r.days}</td>}
      {period === "daily" && (
        <td className="hidden py-3 text-right text-paper-dim sm:table-cell">{r.timeMs != null ? formatDuration(r.timeMs) : ""}</td>
      )}
      <td className="py-3 pr-1 text-right">{r.score}</td>
    </tr>
  );
}
