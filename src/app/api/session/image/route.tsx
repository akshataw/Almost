import { ImageResponse } from "next/og";
import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";
import { isValidDate } from "@/lib/game/requestDate";
import { startRound } from "@/lib/game/session";
import { canvasSize, puzzleSvg } from "@/lib/puzzle/svg";
import type { PuzzleSpec } from "@/lib/puzzle/types";

/** Render scale: 2× for sharp images on high-density phone screens. */
const SCALE = 2;
/** Rendered PNGs are identical for every player, so keep them per server instance. */
const cache = new Map<string, ArrayBuffer>();

async function render(key: string, spec: PuzzleSpec): Promise<ArrayBuffer> {
  const hit = cache.get(key);
  if (hit) return hit;
  const { width, height } = canvasSize(spec);
  const svg = `data:image/svg+xml;base64,${Buffer.from(puzzleSvg(spec)).toString("base64")}`;
  const png = await new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={svg} width={width * SCALE} height={height * SCALE} alt="" />
    ),
    { width: Math.round(width * SCALE), height: Math.round(height * SCALE) },
  ).arrayBuffer();
  if (cache.size > 64) cache.clear();
  cache.set(key, png);
  return png;
}

/**
 * The picture for a round of the player's own run. Only served for rounds the player has reached.
 * The first request for the current round starts that round's clock on the server.
 */
export async function GET(request: Request) {
  const userId = await getUserId({ create: false });
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const round = Number(params.get("round"));
  if (!isValidDate(date) || !Number.isInteger(round) || round < 1 || round > 5) {
    return new Response("Bad request", { status: 400 });
  }

  const store = await getStore();
  const session = await store.getSession(userId, date);
  if (!session) return new Response("Not found", { status: 404 });
  // never serve a round the player hasn't reached yet
  if (session.status === "active" && round > session.currentRound) return new Response("Not yet", { status: 403 });

  const challenge = await store.getChallenge(date);
  const spec = challenge.puzzles[round - 1];
  // render first, then start the clock, so render time never counts against the player
  const png = await render(`${date}|${challenge.version}|${round}`, spec);

  if (session.status === "active" && round === session.currentRound) {
    const now = Date.now();
    for (let tries = 0, s = session; tries < 2; tries++) {
      const started = startRound(s, now);
      if (!started || (await store.saveSession(started, s.version))) break;
      const fresh = await store.getSession(userId, date);
      if (!fresh) break;
      s = fresh;
    }
  }

  return new Response(png, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
