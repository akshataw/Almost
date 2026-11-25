"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionView } from "@/lib/game/view";
import { PuzzleCanvas, type CanvasState } from "../PuzzleCanvas";
import { Intro } from "./Intro";
import { Results } from "./Results";
import { RoundFooter, RoundProgress } from "./RoundHud";
import { SoundToggle } from "./SoundToggle";
import { Turnstile, TURNSTILE_SITE_KEY } from "../Turnstile";
import { play } from "@/lib/sound";

const INTRO_KEY = "almost.introSeen";
const ADVANCE_DELAY_MS = 1400;

type AttemptResponse = {
  correct: boolean;
  attemptsLeft: number;
  roundOver: boolean;
  revealIndex: number | null;
  roundScore: number;
  view: SessionView;
};

const emptyCanvas = (wrong: number[] = []): CanvasState => ({
  wrong,
  lastWrong: null,
  revealed: null,
  outcome: null,
  pending: null,
});

function readIntroSeen() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function Game() {
  const [phase, setPhase] = useState<"boot" | "intro" | "verify" | "loading" | "playing" | "results" | "error">("boot");
  const [view, setView] = useState<SessionView | null>(null);
  const [canvas, setCanvas] = useState<CanvasState>(emptyCanvas());
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [flash, setFlash] = useState<{ text: string; n: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerBase = useRef<{ at: number; offset: number } | null>(null);
  const busy = useRef(false);
  const identity = useRef<Promise<unknown> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** for a resumed round whose clock is already running: elapsed time when the view arrived */
  const resumeAt = useRef<{ at: number; offset: number } | null>(null);

  const applyView = useCallback((v: SessionView) => {
    setView(v);
    if (v.status === "complete") {
      timerBase.current = null;
      setPhase("results");
      return;
    }
    setCanvas(emptyCanvas(v.wrong));
    setAttemptsLeft(v.attemptsLeft);
    setElapsed(v.roundElapsedMs);
    // the display timer starts when the picture is on screen (see onShown); a resumed round continues
    timerBase.current = null;
    resumeAt.current = v.roundStarted ? { at: performance.now(), offset: v.roundElapsedMs } : null;
    setPhase("playing");
  }, []);

  const onShown = useCallback(() => {
    timerBase.current = resumeAt.current ?? { at: performance.now(), offset: 0 };
  }, []);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const start = useCallback(
    async (captchaToken?: string) => {
      setPhase("loading");
      try {
        await identity.current; // don't race the background guest sign-in (two guests would be created)
        const res = await fetch("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(captchaToken ? { captchaToken } : {}),
        });
        if (res.status === 401) {
          const d = await res.json().catch(() => null);
          if (d?.error === "captcha_required") {
            identity.current = null;
            setPhase("verify"); // new visitor without a verified guest account yet
            return;
          }
        }
        if (!res.ok) throw new Error(String(res.status));
        applyView(await res.json());
      } catch {
        setPhase("error");
      }
    },
    [applyView],
  );

  // create the guest account in the background while the intro plays (with a bot check if enabled)
  const identify = useCallback((captchaToken?: string) => {
    identity.current = fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(captchaToken ? { captchaToken } : {}),
    }).catch(() => undefined);
  }, []);

  // first visit shows the intro; returning players go straight in
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (readIntroSeen()) start();
      else {
        setPhase("intro");
        if (!TURNSTILE_SITE_KEY) identify(); // with bot protection, the widget below calls identify
      }
    });
    return () => {
      cancelled = true;
    };
  }, [start, identify]);

  // display timer (server time is authoritative for scoring)
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const b = timerBase.current;
      if (b) setElapsed(b.offset + performance.now() - b.at);
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  const ready = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {}
    start();
  };

  const select = async (index: number) => {
    if (!view || busy.current || canvas.revealed !== null) return;
    busy.current = true;
    let advancing = false;
    play("tap");
    setCanvas((c) => ({ ...c, pending: index }));
    try {
      const res = await fetch("/api/session/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: view.date, round: view.currentRound, index }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCanvas((c) => ({ ...c, pending: null }));
        if (data?.view) applyView(data.view);
        else if (data?.error === "expired" || data?.error === "no_session" || res.status === 401) start();
        else setPhase("error");
        return;
      }
      const r = data as AttemptResponse;
      setAttemptsLeft(r.attemptsLeft);
      if (!r.roundOver) {
        setCanvas((c) => ({
          ...c,
          pending: null,
          wrong: [...c.wrong, index],
          lastWrong: { index, n: (c.lastWrong?.n ?? 0) + 1 },
        }));
        play("wrong");
        if (navigator.vibrate) navigator.vibrate(30);
        return;
      }
      // round over: freeze timer, reveal quietly, then advance
      timerBase.current = null;
      setCanvas((c) => ({
        ...c,
        pending: null,
        wrong: r.correct ? c.wrong : [...c.wrong, index],
        lastWrong: r.correct ? c.lastWrong : { index, n: (c.lastWrong?.n ?? 0) + 1 },
        revealed: r.revealIndex,
        outcome: r.correct ? "found" : "missed",
      }));
      setFlash({ text: r.correct ? `+${r.roundScore}` : "Missed", n: Date.now() });
      play(r.correct ? "correct" : "missed");
      advancing = true;
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        busy.current = false;
        setFlash(null);
        applyView(r.view);
      }, ADVANCE_DELAY_MS);
      return;
    } catch {
      setCanvas((c) => ({ ...c, pending: null }));
    } finally {
      if (!advancing) busy.current = false;
    }
  };

  if (phase === "boot") return <div className="flex-1" />;
  if (phase === "intro")
    return (
      <>
        <Intro onReady={ready} busy={false} />
        <Turnstile action="guest" onToken={identify} />
      </>
    );
  if (phase === "verify")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <span className="label">Checking you&apos;re a person…</span>
        <Turnstile action="guest" onToken={(t) => start(t)} />
      </div>
    );
  if (phase === "loading")
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="label animate-pulse">Preparing today&apos;s experiment…</span>
      </div>
    );
  if (phase === "error")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-paper-dim">The experiment could not be loaded.</p>
        <button onClick={() => start()} className="label underline">
          Try again
        </button>
      </div>
    );
  if (phase === "results" && view) return <Results view={view} />;
  if (!view?.puzzle) return null;

  const roundLocked = canvas.revealed !== null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 pt-2">
      <RoundProgress view={view} />
      <div className="relative mx-auto w-full max-w-[min(100%,calc(100dvh-17rem))]">
        <PuzzleCanvas
          puzzle={view.puzzle}
          imageUrl={view.imageUrl!}
          state={canvas}
          disabled={roundLocked}
          onSelect={select}
          onShown={onShown}
        />
        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.n}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`pointer-events-none absolute inset-x-0 -bottom-2 translate-y-full text-center font-mono text-lg ${
                canvas.outcome === "found" ? "text-signal" : "text-anomaly"
              }`}
            >
              {flash.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.p
        key={view.currentRound}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="min-h-12 pt-4 text-center text-paper-dim"
      >
        {view.puzzle.instruction}
      </motion.p>
      <div className="mt-auto space-y-3 pb-4">
        <RoundFooter elapsedMs={elapsed} attemptsLeft={attemptsLeft} />
        <div className="flex justify-center">
          <SoundToggle />
        </div>
      </div>
    </div>
  );
}
