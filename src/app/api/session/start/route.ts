import { utcDateString } from "@/lib/date";
import { getStore } from "@/lib/game/getStore";
import { captchaEnabled, getUserId, readCaptchaToken } from "@/lib/game/identity";
import { newSession } from "@/lib/game/session";
import { toView } from "@/lib/game/view";

/** Start (or resume) today's run for the current player. */
export async function POST(request: Request) {
  const captchaToken = await readCaptchaToken(request);
  const userId = await getUserId({ create: true, captchaToken });
  if (!userId) return Response.json({ error: captchaEnabled() ? "captcha_required" : "unauthorized" }, { status: 401 });

  const store = await getStore();
  const now = Date.now();
  const date = utcDateString(new Date(now));
  const challenge = await store.getChallenge(date);

  let session = await store.getSession(userId, date);
  if (!session) {
    try {
      session = await store.createSession(newSession(crypto.randomUUID(), userId, date, now));
    } catch (e) {
      if ((e as Error).name !== "StaleIdentityError") throw e;
      // cookie belonged to a deleted account: start over as a new guest
      const { replaceSupabaseIdentity } = await import("@/lib/supabase/server");
      const freshId = await replaceSupabaseIdentity(captchaToken);
      if (!freshId) return Response.json({ error: captchaEnabled() ? "captcha_required" : "unauthorized" }, { status: 401 });
      session = await store.createSession(newSession(crypto.randomUUID(), freshId, date, now));
    }
  }

  const standing = session.status === "complete" ? await store.getStanding(session.userId, date) : null;
  return Response.json(toView(session, challenge, now, standing), {
    headers: { "Cache-Control": "no-store" },
  });
}
