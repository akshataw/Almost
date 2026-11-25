import { createHmac } from "node:crypto";

/**
 * Daily seeds. The generator is open source, so the seed must include a secret: otherwise anyone
 * could run the code for tomorrow's date and know every answer in advance.
 * seed = "almost-<date>-v<version>-" + HMAC-SHA256(PUZZLE_SECRET, "almost-<date>-v<version>")
 * Server / scripts only (never imported by browser code).
 */
export function dailySeed(date: string, version: number, secret: string | undefined = process.env.PUZZLE_SECRET): string {
  const base = `almost-${date}-v${version}`;
  if (!secret) return base; // local demo mode / tests only — see requirePuzzleSecret()
  return `${base}-${createHmac("sha256", secret).update(base).digest("hex").slice(0, 32)}`;
}

/** Real (stored) puzzles must never be generated without the secret. */
export function requirePuzzleSecret(): string {
  const secret = process.env.PUZZLE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PUZZLE_SECRET is missing or too short (32+ characters). Add it to .env.local / Vercel.");
  }
  return secret;
}
