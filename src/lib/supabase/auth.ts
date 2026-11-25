import "server-only";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { siteOrigin } from "./env";
import { supabaseServer } from "./server";

/**
 * Email login. One flow for everyone:
 *  - guest + new email      → "link": the guest account becomes a real account (progress kept)
 *  - guest + existing email → "signin": log into that account; guest runs are merged into it
 *  - no account at all      → "signin": creates the account
 * The email contains a link and (if the template includes {{ .Token }}) a 6-digit code.
 */
export type LoginMode = "link" | "signin";

const PENDING_COOKIE = "almost_login";
const PENDING_MAX_AGE = 60 * 60; // codes/links are valid for an hour by default

type Pending = { email: string; mode: LoginMode };

async function setPending(p: Pending) {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, JSON.stringify(p), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE,
  });
}

async function takePending(): Promise<Pending | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Pending;
    return typeof p.email === "string" && (p.mode === "link" || p.mode === "signin") ? p : null;
  } catch {
    return null;
  }
}

async function clearPending() {
  (await cookies()).delete(PENDING_COOKIE);
}

/** Current user from the auth cookie (verified), or null. */
export async function currentClaims(): Promise<{ id: string; anonymous: boolean } | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, anonymous: Boolean(c.is_anonymous) } : null;
}

export type StartError = "already_logged_in" | "rate_limited" | "invalid_email" | "email_not_allowed" | "failed";
export type StartResult = { ok: true } | { ok: false; error: StartError };

/** Map Supabase Auth errors to what the player can act on. */
function startError(error: { status?: number; code?: string; message: string }, what: string): StartResult {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return { ok: false, error: "rate_limited" };
  if (error.code === "email_address_invalid") return { ok: false, error: "invalid_email" };
  // Supabase's built-in email service only sends to project team members until custom SMTP is set up
  if (error.code === "email_address_not_authorized") return { ok: false, error: "email_not_allowed" };
  console.error(`[almost] ${what} failed:`, error.code ?? error.message);
  return { ok: false, error: "failed" };
}

export async function startEmailLogin(email: string, requestUrl: string, captchaToken?: string): Promise<StartResult> {
  const supabase = await supabaseServer();
  const me = await currentClaims();
  if (me && !me.anonymous) return { ok: false, error: "already_logged_in" };
  const redirect = `${siteOrigin(requestUrl)}/auth/callback?next=/profile`;

  if (me?.anonymous) {
    // try to attach the email to this guest account (keeps everything)
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirect });
    if (!error) {
      await setPending({ email, mode: "link" });
      return { ok: true };
    }
    if (error.code !== "email_exists" && error.code !== "user_already_exists") return startError(error, "link email");
    // the email already belongs to an account → log into it instead
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: !me, emailRedirectTo: redirect, captchaToken },
  });
  if (error) return startError(error, "login email");
  await setPending({ email, mode: "signin" });
  return { ok: true };
}

/** After a successful sign-in on this device: fold the previous guest's runs into the account. */
async function mergeIfGuestReplaced(previous: { id: string; anonymous: boolean } | null) {
  if (!previous?.anonymous) return;
  const now = await currentClaims();
  if (!now || now.id === previous.id) return;
  const { mergeGuestInto } = await import("../game/supabaseStore");
  await mergeGuestInto(previous.id, now.id).catch((e) => console.error("[almost] merge failed:", (e as Error).message));
}

export type VerifyResult = { ok: true } | { ok: false; error: "no_pending" | "invalid_code" };

/** Verify the 6-digit code from the email. */
export async function verifyEmailCode(token: string): Promise<VerifyResult> {
  const pending = await takePending();
  if (!pending) return { ok: false, error: "no_pending" };
  const previous = await currentClaims();
  const supabase = await supabaseServer();
  const type: EmailOtpType = pending.mode === "link" ? "email_change" : "email";
  const { error } = await supabase.auth.verifyOtp({ email: pending.email, token, type });
  if (error) return { ok: false, error: "invalid_code" };
  await clearPending();
  await mergeIfGuestReplaced(previous);
  return { ok: true };
}

/** Complete a login from an email link (`?code=` PKCE or `?token_hash=&type=`). */
export async function completeFromLink(params: URLSearchParams): Promise<boolean> {
  const previous = await currentClaims();
  const supabase = await supabaseServer();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (!ok) return false;
  await clearPending();
  await mergeIfGuestReplaced(previous);
  return true;
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: "local" });
  await clearPending();
}
