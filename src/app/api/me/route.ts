import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";

/** Who is on this device: nobody yet, a guest, or a logged-in player. */
export async function GET() {
  const userId = await getUserId({ create: false });
  if (!userId) return Response.json({ account: null }, { headers: { "Cache-Control": "no-store" } });
  const store = await getStore();
  const account = await store.getAccount(userId).catch(() => null);
  return Response.json({ account }, { headers: { "Cache-Control": "no-store" } });
}
