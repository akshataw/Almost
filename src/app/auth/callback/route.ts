import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/game/email";
import { hasSupabase } from "@/lib/game/getStore";

/** Landing page for email links (login and email confirmation). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  let ok = false;
  if (hasSupabase()) {
    const { completeFromLink } = await import("@/lib/supabase/auth");
    ok = await completeFromLink(url.searchParams);
  }
  // redirect() (not Response.redirect) so the session cookies set above are kept on the response
  redirect(ok ? `${next}${next.includes("?") ? "&" : "?"}welcome=1` : "/login?error=link");
}
