import { Dashboard } from "@/components/dashboard";
import { getCsrfCookie } from "@/server/auth/cookies";
import { getCurrentSessionOrNull } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getCurrentSessionOrNull();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="mb-2 text-2xl font-semibold">EVE Fitting Exporter</h1>
          <p className="mb-4 text-sm text-zinc-400">
            Connect your EVE account to sync fittings to private server storage and browse them locally.
          </p>
          <a className="inline-block rounded bg-cyan-700 px-4 py-2 text-sm text-white" href="/api/auth/login">
            Connect EVE Account
          </a>
        </div>
      </div>
    );
  }

  const csrfToken = (await getCsrfCookie()) ?? "";
  return <Dashboard characterId={session.characterId} csrfToken={csrfToken} />;
}