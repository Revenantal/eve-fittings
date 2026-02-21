import Image from "next/image";
import { Dashboard } from "@/components/dashboard";
import { SiteFooter } from "@/components/site-footer";
import { getCsrfCookie } from "@/server/auth/cookies";
import { getCurrentSessionOrNull } from "@/server/auth/current-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getCurrentSessionOrNull();

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <main className="flex-1">
          <section className="relative overflow-hidden bg-zinc-900">
            <Image
              src="/landing/landing.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
              aria-hidden="true"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-slate-950/35 to-slate-950/80" />
            <div className="relative z-10 mx-auto flex min-h-[68vh] w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
              <div className="mb-14">
                <div className="inline-flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center text-cyan-300" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2l2.7 6.2L21 11l-6.3 2.8L12 20l-2.7-6.2L3 11l6.3-2.8L12 2z" />
                    </svg>
                  </span>
                  <span className="inline-flex flex-col">
                    <span className="text-base font-semibold tracking-wide text-zinc-100">EVE Fittings</span>
                    <span className="text-xs tracking-wide text-zinc-400">Revenantal</span>
                  </span>
                </div>
              </div>
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
                <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
                  Save, organize, and recover your EVE fittings without the in-game limits.
                </h1>
                <p className="mt-4 max-w-2xl text-pretty text-base text-zinc-300 sm:text-lg">
                  EVE Fittings gives you cloud-backed fitting management with quick retrieval across devices and secure session-based access.
                </p>
                <a
                  href="/api/auth/login"
                  className="mt-8 inline-flex items-center rounded bg-cyan-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                >
                  Log in with EVE SSO
                </a>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-6xl bg-zinc-950 px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">Key features</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Built for pilots who need reliable fitting management beyond the standard EVE fitting cap.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="rounded bg-zinc-900 p-5">
                <h3 className="text-base font-semibold text-zinc-100">Unlimited fitting storage</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Save as many fittings as you want without worrying about hitting the 500 fitting limit in EVE.
                </p>
              </article>
              <article className="rounded bg-zinc-900 p-5">
                <h3 className="text-base font-semibold text-zinc-100">Easy access</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Access your saved fittings from any device with an internet connection for fast organization on the go.
                </p>
              </article>
              <article className="rounded bg-zinc-900 p-5">
                <h3 className="text-base font-semibold text-zinc-100">Secure storage</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Keep fittings protected in cloud storage with encrypted credentials and regular backup-oriented workflows.
                </p>
              </article>
            </div>
          </section>
        </main>
        <SiteFooter className="bg-zinc-950/95" />
      </div>
    );
  }

  const csrfToken = (await getCsrfCookie()) ?? "";
  return (
    <div className="flex min-h-screen flex-col">
      <main className="min-h-0 flex-1">
        <Dashboard characterId={session.characterId} csrfToken={csrfToken} />
      </main>
      <SiteFooter />
    </div>
  );
}
