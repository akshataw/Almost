import { ImageResponse } from "next/og";
import { MAX_DAILY_SCORE, SITE_URL } from "@/lib/config";
import { experimentNumber, formatDuration, formatExperiment, utcDateString } from "@/lib/date";
import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";
import { isValidDate } from "@/lib/game/requestDate";
import { summarize } from "@/lib/game/session";

const INK = "#111318";
const PAPER = "#f2f0e9";
const DIM = "#8a8984";
const SIGNAL = "#d8a94f";
const ANOMALY = "#7189d9";

/** 1200×630 PNG score card for the current player's completed run. */
export async function GET(request: Request) {
  const userId = await getUserId({ create: false });
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? utcDateString();
  if (!isValidDate(date)) return new Response("Bad date", { status: 400 });

  const store = await getStore();
  const session = await store.getSession(userId, date);
  if (!session || session.status !== "complete") return new Response("Not found", { status: 404 });
  const s = summarize(session);
  const standing = await store.getStanding(userId, date);

  const stats = [
    { label: "TIME", value: formatDuration(s.completionTimeMs) },
    { label: "PERFECT", value: `${s.perfectRounds}/${s.rounds.length}` },
    { label: "POSITION", value: standing ? `#${standing.rank}` : "—" },
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: PAPER, padding: 72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            almost<span style={{ color: SIGNAL }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: DIM }}>
            DAILY EXPERIMENT <span style={{ color: SIGNAL, marginLeft: 12 }}>#{formatExperiment(experimentNumber(date))}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 168, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>
            {s.totalScore}
            <span style={{ fontSize: 64, color: DIM, marginLeft: 16, letterSpacing: -2 }}>/ {MAX_DAILY_SCORE}</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
            {s.rounds.map((r) => (
              <div
                key={r.round}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 40,
                  border: `3px solid ${r.correct ? SIGNAL : ANOMALY}`,
                  background: r.correct && r.attempts === 1 ? SIGNAL : "transparent",
                  display: "flex",
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 64 }}>
            {stats.map((x) => (
              <div key={x.label} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 44, fontWeight: 700 }}>{x.value}</div>
                <div style={{ fontSize: 18, letterSpacing: 5, color: DIM }}>{x.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 26, color: PAPER }}>Can you spot what I missed?</div>
            <div style={{ fontSize: 22, color: SIGNAL, letterSpacing: 2 }}>{SITE_URL}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "private, no-store" } },
  );
}
