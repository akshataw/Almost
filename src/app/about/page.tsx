import Link from "next/link";
import { ATTEMPTS_PER_ROUND, MAX_DAILY_SCORE, ROUNDS_PER_DAY } from "@/lib/config";

export const metadata = { title: "About — almost." };

export default function About() {
  return (
    <article className="max-w-xl animate-fade-in space-y-8 pt-6 sm:pt-12">
      <header className="space-y-3">
        <p className="label">About the experiment</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">
          Everything looks right.
          <br />
          Something isn&apos;t.
        </h1>
      </header>

      <section className="space-y-3 text-paper-dim">
        <p>
          Every day at 00:00 UTC a new experiment appears. It holds {ROUNDS_PER_DAY} patterns, and
          each pattern has one element that is almost — but not quite — like the others.
        </p>
        <p>Everyone in the world sees the same patterns. Find the anomaly. Tap it.</p>
      </section>

      <section className="space-y-3">
        <h2 className="label">Scoring</h2>
        <ul className="space-y-2 font-mono text-sm">
          <li className="flex justify-between border-b border-ink-3 pb-2"><span>Correct answer</span><span>100</span></li>
          <li className="flex justify-between border-b border-ink-3 pb-2"><span>Found on first attempt</span><span>+25</span></li>
          <li className="flex justify-between border-b border-ink-3 pb-2"><span>Found on second attempt</span><span>+10</span></li>
          <li className="flex justify-between border-b border-ink-3 pb-2"><span>Speed bonus</span><span>0–25</span></li>
          <li className="flex justify-between text-signal"><span>Maximum per day</span><span>{MAX_DAILY_SCORE}</span></li>
        </ul>
        <p className="text-sm text-paper-dim">
          You get {ATTEMPTS_PER_ROUND} attempts per pattern. Wrong guesses never cost points — they
          just cost the bonus.
        </p>
      </section>

      <section className="space-y-3 text-paper-dim">
        <h2 className="label">Fair play</h2>
        <p>
          Scores are calculated on the server. Only your first completed run of the day counts
          towards the rankings. No signup needed — you play as a guest until you choose to keep
          your profile.
        </p>
      </section>

      <Link href="/play" className="inline-block font-mono text-sm tracking-[0.2em] text-signal uppercase">
        Start today&apos;s experiment →
      </Link>
    </article>
  );
}
