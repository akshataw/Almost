import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server code only — never expose its results unfiltered. */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  client = createClient(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
