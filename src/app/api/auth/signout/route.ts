import { hasSupabase } from "@/lib/game/getStore";

/** Log out on this device. The next game starts a fresh guest. */
export async function POST() {
  if (!hasSupabase()) return Response.json({ error: "unavailable" }, { status: 501 });
  const { signOut } = await import("@/lib/supabase/auth");
  await signOut();
  return Response.json({ ok: true });
}
