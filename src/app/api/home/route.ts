import { utcDateString } from "@/lib/date";
import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";

export async function GET() {
  const userId = await getUserId({ create: false });
  const store = await getStore();
  const stats = await store.getHomeStats(userId, utcDateString());
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}
