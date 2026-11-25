import { Leaderboard } from "@/components/Leaderboard";

export const metadata = { title: "Leaderboard — almost." };

export default function LeaderboardPage() {
  return (
    <div className="animate-fade-in space-y-8 pt-6 sm:pt-12">
      <header className="space-y-2">
        <p className="label">Rankings</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Who noticed first.</h1>
      </header>
      <Leaderboard />
    </div>
  );
}
