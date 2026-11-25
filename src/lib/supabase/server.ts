import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Per-request client acting as the signed-in (possibly anonymous) player. */
export async function supabaseServer() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const jar = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // called from a Server Component: cookies are read-only there; route handlers can write
        }
      },
    },
  });
}

/** Verified user id from the auth cookie; signs in anonymously when asked to. */
export async function getSupabaseUserId(opts: { create: boolean; captchaToken?: string }): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (typeof sub === "string" && sub) return sub;
  if (!opts.create) return null;
  const { data: anon, error } = await supabase.auth.signInAnonymously(
    opts.captchaToken ? { options: { captchaToken: opts.captchaToken } } : undefined,
  );
  if (error) {
    console.error("[almost] anonymous sign-in failed:", error.message);
    return null;
  }
  return anon.user?.id ?? null;
}

/** Drop the current (stale) session cookie and sign in as a fresh guest. */
export async function replaceSupabaseIdentity(captchaToken?: string): Promise<string | null> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const { data, error } = await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
  if (error) {
    console.error("[almost] anonymous sign-in failed:", error.message);
    return null;
  }
  return data.user?.id ?? null;
}
