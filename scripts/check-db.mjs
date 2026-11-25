// Checks that the schema is installed. Prints table status only — never secrets.
// Usage: node --env-file=.env.local scripts/check-db.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
let ok = true;
for (const t of ["profiles", "daily_challenges", "game_sessions", "round_results"]) {
  const { error, count } = await db.from(t).select("*", { count: "exact" }).limit(1);
  console.log(`${t.padEnd(18)} ${error ? "MISSING (" + (error.code ?? error.message) + ")" : `ok, ${count} rows`}`);
  if (error) ok = false;
}
const { error: rpcErr } = await db.rpc("ranked", { p_period: "daily", p_date: "2026-01-01" });
console.log(`${"ranked()".padEnd(18)} ${rpcErr ? "MISSING (" + (rpcErr.code ?? rpcErr.message) + ")" : "ok"}`);
process.exit(ok && !rpcErr ? 0 : 2);
