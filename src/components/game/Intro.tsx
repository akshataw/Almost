"use client";

import { motion } from "motion/react";
import { ATTEMPTS_PER_ROUND } from "@/lib/config";

export function Intro({ onReady, busy }: { onReady: () => void; busy: boolean }) {
  const lines = ["Five patterns. Five anomalies.", "Find what's almost right.", `You have ${ATTEMPTS_PER_ROUND === 3 ? "three" : ATTEMPTS_PER_ROUND} attempts per pattern.`];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
      <div className="space-y-3">
        {lines.map((l, i) => (
          <motion.p
            key={l}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.25 + i * 0.55, duration: 0.7 }}
            className={i === 0 ? "font-display text-3xl font-medium tracking-tight sm:text-5xl" : "text-lg text-paper-dim sm:text-xl"}
          >
            {l}
          </motion.p>
        ))}
      </div>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        onClick={onReady}
        disabled={busy}
        className="bg-paper px-8 py-4 font-mono text-sm tracking-[0.25em] text-ink uppercase transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        I&apos;m ready
      </motion.button>
    </div>
  );
}
