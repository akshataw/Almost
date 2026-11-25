import "server-only";

/**
 * The only place environment secrets are read. `server-only` makes the build fail
 * if any client component imports this file, so the secret key can't reach the browser.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey) return null;
  return { url, publishableKey, secretKey };
}

/**
 * Public origin used in auth email links (e.g. https://playalmost.com). Not secret.
 * Falls back to the request's origin in development; set SITE_ORIGIN in production so links
 * never depend on the incoming Host header.
 */
export function siteOrigin(requestUrl: string): string {
  const configured = process.env.SITE_ORIGIN?.replace(/\/+$/, "");
  return configured || new URL(requestUrl).origin;
}
