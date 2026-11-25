"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Account } from "@/lib/game/store";

/** undefined = loading, null = no account on this device yet. Refreshes on navigation. */
export function useAccount(): Account | null | undefined {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { account: null }))
      .then((d) => alive && setAccount(d.account ?? null))
      .catch(() => alive && setAccount(null));
    return () => {
      alive = false;
    };
  }, [pathname]);
  return account;
}
