import "server-only";
import { cookies } from "next/headers";
import { hasSupabase } from "./getStore";

const GUEST_COOKIE = "almost_guest";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who is playing. With Supabase: the (anonymous) auth user from the session cookie,
 * signing in anonymously on demand. Without: an httpOnly guest cookie (dev only).
 */
export async function getUserId(opts: { create: boolean; captchaToken?: string }): Promise<string | null> {
  if (hasSupabase()) {
    const { getSupabaseUserId } = await import("../supabase/server");
    return getSupabaseUserId(opts);
  }
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return existing;
  if (!opts.create) return null;
  const id = crypto.randomUUID();
  jar.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}

/**
 * Bot protection for creating guest accounts and sending sign-in emails (Cloudflare Turnstile,
 * verified by Supabase Auth). On only when a site key is configured, so local dev works without it.
 */
export function captchaEnabled(): boolean {
  return hasSupabase() && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** Reads an optional `captchaToken` from a JSON request body. */
export async function readCaptchaToken(request: Request): Promise<string | undefined> {
  const body: unknown = await request.json().catch(() => null);
  const t = body && typeof body === "object" ? (body as { captchaToken?: unknown }).captchaToken : undefined;
  return typeof t === "string" && t.length > 0 && t.length < 4096 ? t : undefined;
}
