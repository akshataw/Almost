import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";
import { isPlayableDate, isValidDate } from "@/lib/game/requestDate";
import { applyAttempt } from "@/lib/game/session";
import { toView } from "@/lib/game/view";


export async function POST(request: Request) {
  const userId = await getUserId({ create: false });
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "bad_request" }, { status: 400 });
  const { date, round, index } = body as { date?: unknown; round?: unknown; index?: unknown };
  if (!isValidDate(date) || !Number.isInteger(round) || !Number.isInteger(index)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const now = Date.now();
  if (!isPlayableDate(date, now)) return Response.json({ error: "expired" }, { status: 409 });

  const store = await getStore();
  const challenge = await store.getChallenge(date);

  // optimistic concurrency: retry once if two taps race
  for (let tries = 0; tries < 2; tries++) {
    const session = await store.getSession(userId, date);
    if (!session) return Response.json({ error: "no_session" }, { status: 404 });

    const outcome = applyAttempt(session, { round: round as number, index: index as number }, challenge, now);
    if (!outcome.ok) {
      return Response.json(
        { error: outcome.error, view: toView(session, challenge, now) },
        { status: 409 },
      );
    }
    if (!(await store.saveSession(outcome.state, session.version))) continue;

    const standing = outcome.state.status === "complete" ? await store.getStanding(userId, date) : null;
    return Response.json(
      {
        correct: outcome.correct,
        attemptsLeft: outcome.attemptsLeft,
        roundOver: outcome.roundOver,
        revealIndex: outcome.revealIndex,
        roundScore: outcome.roundScore,
        view: toView(outcome.state, challenge, now, standing),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ error: "conflict" }, { status: 409 });
}
