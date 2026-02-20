export default function Loading() {
  return (
    <div className="skeleton-shell-delayed flex min-h-screen w-full items-start gap-4 p-4">
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-[400px] shrink-0 flex-col gap-3 rounded bg-zinc-900 p-3">
        <section className="rounded bg-zinc-950/60 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="skeleton h-[80px] w-[80px] shrink-0 rounded" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className="skeleton block h-4 w-3/4 rounded" aria-hidden="true" />
              <span className="skeleton block h-3 w-full rounded" aria-hidden="true" />
              <span className="skeleton block h-3 w-1/2 rounded" aria-hidden="true" />
            </div>
          </div>
        </section>
        <section className="flex min-h-0 flex-1 flex-col rounded bg-zinc-950/50 p-3 shadow-sm">
          <span className="skeleton mb-3 block h-9 w-full rounded" aria-hidden="true" />
          <div className="space-y-2">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className="skeleton block h-7 w-full rounded" aria-hidden="true" />
            ))}
          </div>
        </section>
      </aside>
      <main className="min-w-0 flex flex-1 flex-col gap-3 rounded bg-zinc-900 p-4">
        <section className="rounded bg-zinc-950/60 p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <span className="skeleton h-[352px] w-[352px] rounded-full" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-3">
              <span className="skeleton block h-8 w-2/3 rounded" aria-hidden="true" />
              <span className="skeleton block h-5 w-1/3 rounded" aria-hidden="true" />
              <span className="skeleton block h-4 w-1/4 rounded" aria-hidden="true" />
              <div className="flex gap-2">
                <span className="skeleton block h-8 w-36 rounded" aria-hidden="true" />
                <span className="skeleton block h-8 w-28 rounded" aria-hidden="true" />
                <span className="skeleton block h-8 w-24 rounded" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>
        <section className="min-h-0 flex-1">
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
            <span className="skeleton block h-full min-h-[220px] rounded" aria-hidden="true" />
            <span className="skeleton block h-full min-h-[220px] rounded" aria-hidden="true" />
          </div>
        </section>
      </main>
    </div>
  );
}
