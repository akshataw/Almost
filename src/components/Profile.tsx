"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MAX_DAILY_SCORE } from "@/lib/config";
import { experimentNumber, formatDuration, formatExperiment } from "@/lib/date";
import type { ProfileStats } from "@/lib/game/store";
import { SignOutButton } from "./LoginPanel";

export function Profile() {
  const [profile, setProfile] = useState<ProfileStats | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const d = await res.json();
      setProfile(d.profile ?? null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => alive && load());
    return () => {
      alive = false;
    };
  }, [load]);

  if (profile === undefined) return <p className="label animate-pulse">Loading profile…</p>;
  if (profile === null)
    return (
      <div className="space-y-6">
        <div className="space-y-4 border border-dashed border-ink-3 p-8 text-center">
          <p className="text-paper-dim">You haven&apos;t taken part in an experiment yet.</p>
          <Link href="/play" className="font-mono text-sm tracking-[0.2em] text-signal uppercase">
            Start today&apos;s experiment →
          </Link>
        </div>
        <Link href="/login" className="label hover:text-paper">
          Have an account? Log in →
        </Link>
      </div>
    );

  const stats = [
    { label: "Current streak", value: `${profile.currentStreak}d` },
    { label: "Longest streak", value: `${profile.longestStreak}d` },
    { label: "Experiments", value: String(profile.played) },
    { label: "Average score", value: String(profile.averageScore) },
    { label: "Best daily score", value: String(profile.bestScore) },
  ];

  return (
    <div className="space-y-10">
      <WelcomeNotice />
      <UsernameEditor name={profile.username} onSaved={load} />

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-ink-3 bg-ink-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-ink p-4 last:col-span-2 sm:last:col-span-1">
            <div className="font-mono text-2xl">{s.value}</div>
            <div className="label mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="label">Recent results</h2>
        {profile.recent.length === 0 ? (
          <p className="text-paper-dim">No completed experiments yet.</p>
        ) : (
          <ul className="font-mono text-sm">
            {profile.recent.map((r) => (
              <li key={r.date} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-ink-3 py-3">
                <span className="text-paper-faint">#{formatExperiment(experimentNumber(r.date))}</span>
                <span className="relative h-1 bg-ink-3">
                  <span className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${(r.score / MAX_DAILY_SCORE) * 100}%` }} />
                </span>
                <span>
                  {r.score} <span className="text-paper-faint">· {formatDuration(r.timeMs)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.isGuest ? (
        <section className="flex flex-col gap-3 border border-ink-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="label">Playing as a guest</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Your profile lives only on this device. Log in with your email to keep your streak and scores everywhere.
            </p>
          </div>
          <Link
            href="/login"
            className="shrink-0 bg-paper px-5 py-3 text-center font-mono text-xs tracking-[0.2em] text-ink uppercase"
          >
            Log in
          </Link>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-6">
          <p className="text-sm text-paper-dim">
            Logged in{profile.email ? <> as <span className="text-paper">{profile.email}</span></> : null}
          </p>
          <SignOutButton />
        </section>
      )}
    </div>
  );
}

function UsernameEditor({ name, onSaved }: { name: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      if (res.ok) {
        setEditing(false);
        onSaved();
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error === "taken" ? "That name is taken." : "3–24 characters: letters, numbers, . _ -");
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing)
    return (
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-display text-4xl font-medium tracking-tight break-all">{name}</h1>
        <button onClick={() => setEditing(true)} className="label hover:text-paper">
          Rename
        </button>
      </div>
    );

  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={24}
          autoFocus
          aria-label="Display name"
          className="min-w-0 flex-1 border border-ink-3 bg-ink-2 px-3 py-2 font-mono text-lg outline-none focus:border-signal"
        />
        <button disabled={saving} className="bg-paper px-4 font-mono text-xs tracking-[0.2em] text-ink uppercase disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="label px-2">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-anomaly">{error}</p>}
    </form>
  );
}

function WelcomeNotice() {
  const [show] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1",
  );
  if (!show) return null;
  return <p className="border border-signal/40 p-3 text-sm text-signal">You&apos;re logged in. Your progress is saved.</p>;
}
