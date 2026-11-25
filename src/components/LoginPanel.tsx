"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/hooks/useAccount";
import { LoginForm } from "./LoginForm";

export function LoginPanel({ linkError }: { linkError: boolean }) {
  const account = useAccount();
  if (account === undefined) return <p className="label animate-pulse">Loading…</p>;

  if (account && !account.isGuest)
    return (
      <div className="space-y-4">
        <p className="text-paper-dim">
          You&apos;re logged in as <span className="text-paper">{account.username}</span>
          {account.email && <> ({account.email})</>}.
        </p>
        <div className="flex gap-6">
          <Link href="/play" className="font-mono text-sm tracking-[0.2em] text-signal uppercase">
            Play today →
          </Link>
          <SignOutButton />
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {linkError && (
        <p className="border border-anomaly/40 p-3 text-sm text-anomaly">
          That login link was invalid or has expired. Enter your email to get a new one.
        </p>
      )}
      {account?.isGuest && (
        <p className="text-paper-dim">
          You&apos;re playing as <span className="text-paper">{account.username}</span>. Log in to keep your streak and
          scores on every device.
        </p>
      )}
      <LoginForm isGuest={Boolean(account?.isGuest)} />
      <p className="text-sm text-paper-faint">
        No account needed to play.{" "}
        <Link href="/play" className="underline hover:text-paper-dim">
          Keep playing as a guest
        </Link>
        .
      </p>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className="label hover:text-paper disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/signout", { method: "POST" });
        } finally {
          router.push("/");
          router.refresh();
        }
      }}
    >
      Log out
    </button>
  );
}
