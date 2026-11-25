"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { useAccount } from "@/hooks/useAccount";

const ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: RankIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
  { href: "/about", label: "About", icon: AboutIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      <Logo />
      <div className="flex items-center gap-6">
        <nav aria-label="Primary" className="hidden gap-6 sm:flex">
          {ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`label transition-colors hover:text-paper ${isActive(pathname, href) ? "!text-paper" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <AccountLink />
      </div>
    </header>
  );
}

/** "Log in" for guests; the player's name once logged in. Hidden during a game. */
function AccountLink() {
  const pathname = usePathname();
  const account = useAccount();
  if (pathname.startsWith("/play") || pathname.startsWith("/login") || account === undefined) return null;
  if (account && !account.isGuest)
    return (
      <Link
        href="/profile"
        className="label max-w-[10rem] truncate normal-case tracking-normal hover:text-paper sm:border-l sm:border-ink-3 sm:pl-6"
      >
        {account.username}
      </Link>
    );
  return (
    <Link
      href="/login"
      className="border border-ink-3 px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] text-paper uppercase hover:border-paper-dim"
    >
      Log in
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/play")) return null; // keep the game screen clear
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-3 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-mono uppercase tracking-widest ${
                  active ? "text-paper" : "text-paper-faint"
                }`}
              >
                <Icon active={active} />
                {label === "Leaderboard" ? "Ranks" : label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { active: boolean };
const stroke = (a: boolean) => (a ? "var(--color-signal)" : "currentColor");

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke(active)} strokeWidth="1.5" aria-hidden>
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="1.6" fill={stroke(active)} />
    </svg>
  );
}
function RankIcon({ active }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke(active)} strokeWidth="1.5" aria-hidden>
      <path d="M4 16V10M10 16V4M16 16V8" strokeLinecap="round" />
    </svg>
  );
}
function ProfileIcon({ active }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke(active)} strokeWidth="1.5" aria-hidden>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c1-3.2 3.3-4.6 6-4.6s5 1.4 6 4.6" strokeLinecap="round" />
    </svg>
  );
}
function AboutIcon({ active }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={stroke(active)} strokeWidth="1.5" aria-hidden>
      <rect x="3.5" y="3.5" width="13" height="13" transform="rotate(4 10 10)" />
    </svg>
  );
}
