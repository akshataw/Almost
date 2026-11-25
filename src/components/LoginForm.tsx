"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";

const ERRORS: Record<string, string> = {
  invalid_email: "That email address can't receive mail. Check it and try again.",
  email_not_allowed: "Login emails can't be sent to this address yet. Please try again later.",
  rate_limited: "Too many emails were requested. Wait a minute and try again.",
  already_logged_in: "You're already logged in.",
  failed: "We couldn't send the email. Try again in a moment.",
  invalid_code: "That code didn't work. Check it, or request a new one.",
  no_pending: "That code has expired. Request a new one.",
  unavailable: "Accounts aren't available in local mode.",
  network: "Couldn't reach the server. Check your connection.",
};

/** Two steps: email → 6-digit code (or tap the link in the email). */
export function LoginForm({ isGuest, next = "/profile" }: { isGuest: boolean; next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [widget, setWidget] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function post(url: string, body: unknown): Promise<string | null> {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) return null;
      const d = await res.json().catch(() => ({}));
      return d.error ?? "failed";
    } catch {
      return "network";
    }
  }

  async function sendEmail(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const err = await post("/api/auth/email", { email, captchaToken: captcha ?? undefined });
    setBusy(false);
    setCaptcha(null);
    setWidget((n) => n + 1);
    if (err) return setError(err);
    setStep("code");
    setCode("");
    setResendIn(60);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await post("/api/auth/verify", { code });
    setBusy(false);
    if (err) return setError(err);
    router.push(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
    router.refresh();
  }

  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY) && !captcha;

  return (
    <div className="space-y-4">
      {step === "email" ? (
        <form onSubmit={sendEmail} className="space-y-3">
          <label className="label block" htmlFor="login-email">
            Email
          </label>
          <div className="flex gap-2">
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 border border-ink-3 bg-ink-2 px-3 py-3 outline-none focus:border-signal"
            />
            <button
              disabled={busy || needsCaptcha}
              className="bg-paper px-5 font-mono text-xs tracking-[0.2em] text-ink uppercase disabled:opacity-50"
            >
              {busy ? "Sending…" : "Continue"}
            </button>
          </div>
          <p className="text-sm text-paper-dim">
            {isGuest
              ? "We'll email you a code. Your guest name, streak and today's game come with you."
              : "We'll email you a code. New here? This creates your account."}
          </p>
          <Turnstile key={widget} action="login" onToken={setCaptcha} />
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-paper-dim">
            We sent an email to <span className="text-paper">{email}</span>. Enter the code from it, or open its link
            on this device.
          </p>
          <label className="label block" htmlFor="login-code">
            Code
          </label>
          <div className="flex gap-2">
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="min-w-0 flex-1 border border-ink-3 bg-ink-2 px-3 py-3 font-mono text-xl tracking-[0.3em] outline-none focus:border-signal"
            />
            <button disabled={busy} className="bg-paper px-5 font-mono text-xs tracking-[0.2em] text-ink uppercase disabled:opacity-50">
              {busy ? "Checking…" : "Log in"}
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            <button type="button" className="label hover:text-paper" onClick={() => setStep("email")}>
              Use a different email
            </button>
            <button
              type="button"
              className="label hover:text-paper disabled:opacity-40"
              disabled={busy || resendIn > 0}
              onClick={() => sendEmail()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-anomaly">
          {ERRORS[error] ?? ERRORS.failed}
        </p>
      )}
    </div>
  );
}
