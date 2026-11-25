const ADJ = ["quiet", "patient", "sharp", "still", "keen", "silent", "careful", "subtle", "steady", "curious", "lucid", "calm"];
const NOUN = ["observer", "pattern", "ghost", "mind", "eye", "signal", "lens", "witness", "shadow", "prism", "echo", "glance"];

/** Anonymous display name derived from the user id (stable, not secret). */
export function anonymousName(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (Math.imul(h, 31) + userId.charCodeAt(i)) >>> 0;
  return `${ADJ[h % ADJ.length]}${NOUN[(h >>> 8) % NOUN.length]}-${String(h % 1000).padStart(3, "0")}`;
}

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
