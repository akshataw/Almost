import { MAX_DAILY_SCORE, ROUNDS_PER_DAY, SITE_URL } from "./config";
import { formatExperiment } from "./date";

export function verdict(score: number): string {
  if (score >= 650) return "You noticed what others missed.";
  if (score >= 500) return "Your eyes are sharper than most.";
  if (score >= 300) return "Almost. That's the point.";
  return "Some things hide well. Come back tomorrow.";
}

export function shareText(r: { experiment: number; score: number; perfectRounds: number; timeMs: number; rounds: { correct: boolean; attempts: number }[] }) {
  const secs = Math.round(r.timeMs / 1000);
  const marks = r.rounds.map((x) => (!x.correct ? "○" : x.attempts === 1 ? "●" : "◐")).join(" ");
  return [
    `almost. / DAILY EXPERIMENT #${formatExperiment(r.experiment)}`,
    "",
    `I scored ${r.score}/${MAX_DAILY_SCORE}.`,
    marks,
    "",
    `${ROUNDS_PER_DAY} patterns.`,
    `${r.perfectRounds} perfect round${r.perfectRounds === 1 ? "" : "s"}.`,
    `${secs} seconds.`,
    "",
    "Can you spot what I missed?",
    SITE_URL,
  ].join("\n");
}
