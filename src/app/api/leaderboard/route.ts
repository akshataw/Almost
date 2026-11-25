import { utcDateString } from "@/lib/date";
import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/game/store";

const PERIODS: LeaderboardPeriod[] = ["daily", "weekly", "alltime"];
const PAGE = 25;

export type PublicRow = Omit<LeaderboardRow, "userId"> & { isMe: boolean };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = (params.get("period") ?? "daily") as LeaderboardPeriod;
  if (!PERIODS.includes(period)) return Response.json({ error: "bad_period" }, { status: 400 });
  const offset = Math.max(0, Math.min(10_000, Math.floor(Number(params.get("offset")) || 0)));

  const userId = await getUserId({ create: false });
  const store = await getStore();
  const page = await store.getLeaderboard(period, utcDateString(), userId, PAGE, offset);

  // never expose other players' ids
  const strip = (r: LeaderboardRow): PublicRow => {
    const { userId: id, ...rest } = r;
    return { ...rest, isMe: id === userId };
  };
  return Response.json(
    {
      period,
      rows: page.rows.map(strip),
      total: page.total,
      me: page.me ? strip(page.me) : null,
      topScore: page.topScore,
      nextOffset: offset + PAGE < page.total ? offset + PAGE : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
