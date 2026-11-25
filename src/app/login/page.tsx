import { Suspense } from "react";
import { LoginPanel } from "@/components/LoginPanel";

export const metadata = { title: "Log in — almost." };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="max-w-lg animate-fade-in space-y-8 pt-6 sm:pt-12">
      <header className="space-y-2">
        <p className="label">Account</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Keep what you noticed.</h1>
      </header>
      <Suspense fallback={<p className="label animate-pulse">Loading…</p>}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Panel({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  return <LoginPanel linkError={error === "link"} />;
}
