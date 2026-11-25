import { utcDateString } from "@/lib/date";
import { getStore } from "@/lib/game/getStore";
import { getUserId } from "@/lib/game/identity";
import { USERNAME_RE } from "@/lib/game/names";

export async function GET() {
  const userId = await getUserId({ create: false });
  if (!userId) return Response.json({ profile: null }, { headers: { "Cache-Control": "no-store" } });
  const store = await getStore();
  const profile = await store.getProfile(userId, utcDateString());
  return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const userId = await getUserId({ create: false });
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!USERNAME_RE.test(username)) return Response.json({ error: "invalid" }, { status: 400 });
  const store = await getStore();
  const res = await store.setUsername(userId, username);
  return Response.json(res, { status: res.ok ? 200 : 409 });
}
