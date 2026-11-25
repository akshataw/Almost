import "server-only";
import { supabaseEnv } from "../supabase/env";
import { memoryStore } from "./memoryStore";
import type { GameStore } from "./store";

export function hasSupabase(): boolean {
  return supabaseEnv() !== null;
}

let warned = false;

export async function getStore(): Promise<GameStore> {
  if (hasSupabase()) {
    const { supabaseStore } = await import("./supabaseStore");
    return supabaseStore;
  }
  if (!warned) {
    warned = true;
    console.warn("[almost] Supabase env vars missing — using in-memory store (data resets on restart).");
  }
  return memoryStore;
}
