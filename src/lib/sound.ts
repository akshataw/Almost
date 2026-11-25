"use client";

/** Tiny WebAudio blips. Off by default; preference remembered per device. */
const KEY = "almost.sound";
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

type Cue = "tap" | "wrong" | "correct" | "missed";

const CUES: Record<Cue, { freq: number[]; dur: number; type: OscillatorType; gain: number }> = {
  tap: { freq: [660], dur: 0.05, type: "sine", gain: 0.05 },
  wrong: { freq: [180, 140], dur: 0.16, type: "triangle", gain: 0.08 },
  correct: { freq: [523, 784], dur: 0.22, type: "sine", gain: 0.07 },
  missed: { freq: [330, 247], dur: 0.3, type: "sine", gain: 0.06 },
};

export function play(cue: Cue) {
  if (!soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const c = CUES[cue];
    const t0 = ctx.currentTime;
    c.freq.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      const start = t0 + i * c.dur * 0.6;
      osc.type = c.type;
      osc.frequency.setValueAtTime(f, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(c.gain, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + c.dur);
      osc.connect(g).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + c.dur + 0.02);
    });
  } catch {}
}
