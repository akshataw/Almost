import { hasSupabase } from "@/lib/game/getStore";

/** Step 2 of login: the code from the email. */
export async function POST(request: Request) {
  if (!hasSupabase()) return Response.json({ error: "unavailable" }, { status: 501 });
  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
  const code = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  if (!/^\d{6,10}$/.test(code)) return Response.json({ error: "invalid_code" }, { status: 400 });
  const { verifyEmailCode } = await import("@/lib/supabase/auth");
  const res = await verifyEmailCode(code);
  if (res.ok) return Response.json({ ok: true });
  return Response.json({ error: res.error }, { status: res.error === "no_pending" ? 409 : 400 });
}
