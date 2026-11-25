import { captchaEnabled, getUserId, readCaptchaToken } from "@/lib/game/identity";

/** Ensures the visitor has a guest identity without starting a run (called while the intro plays). */
export async function POST(request: Request) {
  const captchaToken = await readCaptchaToken(request);
  const userId = await getUserId({ create: true, captchaToken });
  if (userId) return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const error = captchaEnabled() ? "captcha_required" : "unavailable";
  return Response.json({ error }, { status: captchaEnabled() ? 401 : 503, headers: { "Cache-Control": "no-store" } });
}
