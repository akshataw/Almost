import { parseEmail } from "@/lib/game/email";
import { hasSupabase } from "@/lib/game/getStore";

/** Step 1 of login: email a sign-in link + code. */
export async function POST(request: Request) {
  if (!hasSupabase()) return Response.json({ error: "unavailable" }, { status: 501 });
  const body: unknown = await request.json().catch(() => null);
  const email = parseEmail(body);
  if (!email) return Response.json({ error: "invalid_email" }, { status: 400 });
  const rawToken = body && typeof body === "object" ? (body as { captchaToken?: unknown }).captchaToken : undefined;
  const captchaToken = typeof rawToken === "string" && rawToken ? rawToken : undefined;
  const { startEmailLogin } = await import("@/lib/supabase/auth");
  const res = await startEmailLogin(email, request.url, captchaToken);
  if (res.ok) return Response.json({ ok: true });
  const status = { rate_limited: 429, already_logged_in: 409, invalid_email: 400, email_not_allowed: 403, failed: 502 }[res.error];
  return Response.json({ error: res.error }, { status });
}
