import Link from "next/link";
import { HeroPattern } from "@/components/HeroPattern";
import { ExperimentNumber, HomeStatsPanel, RoundDots } from "@/components/HomeLive";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-12 pt-6 sm:pt-12">
      <section className="grid animate-fade-in items-center gap-10 sm:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="label">
            Experiment <span className="text-signal"><ExperimentNumber /></span>
          </p>
          <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-tight sm:text-6xl">
            Something is not
            <br />
            quite right.
          </h1>
          <p className="max-w-sm text-paper-dim">
            Look closer. The answer is hiding in plain sight.
          </p>
          <RoundDots />
          <div className="flex flex-col items-start gap-3">
            <Link
              href="/play"
              className="inline-flex items-center gap-3 bg-paper px-6 py-4 font-mono text-sm tracking-[0.2em] text-ink uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start experiment
              <span aria-hidden>→</span>
            </Link>
            <span className="text-xs text-paper-faint">A new experiment every day · 00:00 UTC</span>
          </div>
        </div>
        <div className="flex justify-center sm:justify-end">
          <HeroPattern />
        </div>
      </section>

      <section className="animate-fade-in [animation-delay:200ms]">
        <HomeStatsPanel />
      </section>
    </div>
  );
}
