"use client";

import { useSyncExternalStore } from "react";
import { msUntilReset, utcDateString } from "@/lib/date";

/** Today's UTC date on the client (null during prerender), re-renders at 00:00 UTC. */
function subscribe(cb: () => void) {
  const id = setTimeout(cb, msUntilReset() + 500);
  return () => clearTimeout(id);
}

export function useToday(): string | null {
  return useSyncExternalStore(subscribe, () => utcDateString(), () => null);
}
