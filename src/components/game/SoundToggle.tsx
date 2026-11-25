"use client";

import { useSyncExternalStore } from "react";
import { setSoundEnabled, soundEnabled } from "@/lib/sound";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function SoundToggle() {
  const on = useSyncExternalStore(subscribe, soundEnabled, () => false);
  return (
    <button
      onClick={() => {
        setSoundEnabled(!on);
        listeners.forEach((l) => l());
      }}
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Turn sound on"}
      className="label flex items-center gap-1.5 hover:text-paper"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M2 6h3l4-3v10L5 10H2z" />
        {on ? <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9" /> : <path d="M11 6l4 4M15 6l-4 4" />}
      </svg>
      {on ? "On" : "Off"}
    </button>
  );
}
