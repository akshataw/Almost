import Link from "next/link";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const cls = size === "lg" ? "text-5xl sm:text-7xl" : "text-xl";
  return (
    <Link
      href="/"
      aria-label="almost. home"
      className={`font-display font-semibold tracking-tight lowercase ${cls}`}
    >
      almost<span className="text-signal">.</span>
    </Link>
  );
}
