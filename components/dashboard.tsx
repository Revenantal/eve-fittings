"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type FitListResponse = {
  updatedAt: string | null;
  groups: Array<{
    shipTypeId: number;
    shipTypeName: string;
    fittings: Array<{
      fittingId: number;
      name: string;
      isSyncedToEve: boolean;
    }>;
  }>;
};

type FitDetailResponse = {
  fitting: unknown;
  canRemoveFromEve: boolean;
  canSyncToEve: boolean;
  shipTypeId: number;
  shipTypeName: string;
  fittingName: string;
};

type FitPyfaResponse = {
  pyfa: string;
};

type ProfileResponse = {
  characterId: number;
  characterName: string;
  corporationName: string;
  allianceName: string | null;
  portraitUrl: string;
};

type DashboardProps = {
  characterId: number;
  csrfToken: string;
};

type ApiError = Error & {
  tone?: Toast["tone"];
  retryAfterSeconds?: number;
};

type Toast = {
  id: number;
  text: string;
  tone: "success" | "error" | "warning";
};

type SyncStatusOverrides = Record<number, boolean>;

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatSyncDate(value: string | null): string {
  if (!value) {
    return "never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-100`}
    />
  );
}

export function Dashboard({ characterId, csrfToken }: DashboardProps) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<FitListResponse>({ updatedAt: null, groups: [] });
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FitDetailResponse | null>(null);
  const [pyfa, setPyfa] = useState<string>("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isPyfaLoading, setIsPyfaLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [isSyncingOne, setIsSyncingOne] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncStatusOverrides, setSyncStatusOverrides] = useState<SyncStatusOverrides>({});
  const [syncCooldownSeconds, setSyncCooldownSeconds] = useState(0);

  const actionBusy = isImporting || isDeleting || isDeletingPermanently || isSyncingOne || isLoggingOut;
  const syncButtonDisabled = actionBusy || syncCooldownSeconds > 0;
  const shipImageUrl = detail ? `https://images.evetech.net/types/${detail.shipTypeId}/render?size=128` : null;
  const selectedSyncOverride = selectedId ? syncStatusOverrides[selectedId] : undefined;
  const selectedIsSyncedToEve = detail ? selectedSyncOverride ?? detail.canRemoveFromEve : false;
  const effectiveCanRemoveFromEve = Boolean(detail && selectedIsSyncedToEve);
  const effectiveCanSyncToEve = Boolean(detail && !selectedIsSyncedToEve);

  function addToast(text: string, tone: Toast["tone"]) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

  const selectedAvailable = useMemo(
    () => (selectedId ? list.groups.some((g) => g.fittings.some((f) => f.fittingId === selectedId)) : false),
    [list.groups, selectedId]
  );

  async function loadProfile() {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as ProfileResponse;
    setProfile(data);
  }

  async function loadList(nextQuery: string) {
    const response = await fetch(`/api/fits?q=${encodeURIComponent(nextQuery)}`, { cache: "no-store" });
    const data = (await response.json()) as FitListResponse;
    setList(data);

    if (!selectedId && data.groups.length > 0 && data.groups[0].fittings.length > 0) {
      setSelectedId(data.groups[0].fittings[0].fittingId);
    }
    if (selectedId && !data.groups.some((g) => g.fittings.some((f) => f.fittingId === selectedId))) {
      setDetail(null);
    }
  }

  async function loadDetail(fittingId: number) {
    setIsDetailLoading(true);
    try {
      const response = await fetch(`/api/fits/${fittingId}`, { cache: "no-store" });
      if (!response.ok) {
        setDetail(null);
        return;
      }
      const data = (await response.json()) as FitDetailResponse;
      setDetail(data);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function loadPyfa(fittingId: number) {
    setIsPyfaLoading(true);
    try {
      const response = await fetch(`/api/fits/${fittingId}/pyfa`, { cache: "no-store" });
      if (!response.ok) {
        setPyfa("Unable to load PYFA format.");
        return;
      }
      const data = (await response.json()) as FitPyfaResponse;
      setPyfa(data.pyfa);
    } finally {
      setIsPyfaLoading(false);
    }
  }

  async function postJson(url: string, body?: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error ?? "Request failed") as ApiError;
      if (response.status === 429) {
        const retryAfterSeconds = typeof data?.details?.retryAfterSeconds === "number" ? data.details.retryAfterSeconds : null;
        error.message = retryAfterSeconds
          ? `Sync requested recently. Retry in ${retryAfterSeconds} seconds.`
          : "Sync requested recently. Please retry shortly.";
        error.tone = "warning";
        if (retryAfterSeconds) {
          error.retryAfterSeconds = retryAfterSeconds;
        }
      } else {
        error.tone = "error";
      }
      throw error;
    }
    return data as Record<string, unknown>;
  }

  async function syncAll() {
    setIsImporting(true);
    try {
      const result = await postJson("/api/fits/sync");
      setSyncStatusOverrides({});
      setSyncCooldownSeconds(0);
      await loadList(query);
      if (selectedId) {
        await loadDetail(selectedId);
        await loadPyfa(selectedId);
      }
      addToast(`Synced ${String(result.count ?? 0)} fittings.`, "success");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.retryAfterSeconds && apiError.retryAfterSeconds > 0) {
        setSyncCooldownSeconds(apiError.retryAfterSeconds);
      }
      addToast(apiError.message, apiError.tone ?? "error");
    } finally {
      setIsImporting(false);
    }
  }

  async function removeFromEve() {
    if (!selectedId || !confirm("Remove this fitting from EVE?") || !effectiveCanRemoveFromEve) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await postJson(`/api/fits/${selectedId}/remove`, { confirm: true });
      await loadList(query);
      await loadDetail(selectedId);
      await loadPyfa(selectedId);
      if (result.stale) {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: false }));
        addToast("Fitting removed from EVE, but refresh failed. Data may be stale.", "warning");
      } else {
        setSyncStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        addToast("Fitting removed from EVE", "success");
      }
    } catch (error) {
      addToast((error as Error).message, "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function syncToEve() {
    if (!selectedId || !effectiveCanSyncToEve) {
      return;
    }
    setIsSyncingOne(true);
    try {
      const result = await postJson(`/api/fits/${selectedId}/sync`);
      await loadList(query);
      await loadDetail(selectedId);
      await loadPyfa(selectedId);
      if (result.stale) {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: true }));
        addToast("Fitting imported to EVE, but refresh failed. Data may be stale.", "warning");
      } else {
        setSyncStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        addToast("Fitting imported to EVE", "success");
      }
    } catch (error) {
      addToast((error as Error).message, "error");
    } finally {
      setIsSyncingOne(false);
    }
  }

  async function deletePermanently() {
    if (
      !selectedId ||
      !confirm("Permanently delete this fitting from local storage? This action cannot be undone and there is no way to recover this fitting.")
    ) {
      return;
    }
    setIsDeletingPermanently(true);
    try {
      const response = await fetch(`/api/fits/${selectedId}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      setSyncStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
      setDetail(null);
      setPyfa("");
      setSelectedId(null);
      await loadList(query);
      addToast("Fitting permanently deleted", "success");
    } catch (error) {
      addToast((error as Error).message, "error");
    } finally {
      setIsDeletingPermanently(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await postJson("/api/auth/logout");
      window.location.reload();
    } catch (error) {
      addToast((error as Error).message, "error");
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadList(query);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void loadDetail(selectedId);
    void loadPyfa(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (syncCooldownSeconds <= 0) {
      return;
    }
    const handle = window.setInterval(() => {
      setSyncCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [syncCooldownSeconds]);

  return (
    <div className="flex min-h-screen w-full items-start gap-4 p-4">
      {isImporting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded bg-zinc-900 px-4 py-3 text-zinc-100 shadow-xl">
            <Spinner className="h-5 w-5 border-zinc-600 border-t-cyan-400" />
            <p className="text-sm">Importing fittings...</p>
          </div>
        </div>
      ) : null}

      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-[400px] shrink-0 flex-col gap-3 rounded bg-zinc-900 p-3">
        <section className="relative rounded bg-zinc-950/60 p-3 shadow-sm">
          <button
            aria-label="Log out"
            title="Log out"
            className="absolute top-3 right-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-red-900/50 text-red-300 transition-colors hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={logout}
            disabled={actionBusy}
          >
            {isLoggingOut ? (
              <Spinner className="h-3.5 w-3.5 border-red-400 border-t-red-100" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-3">
            <Image
              src={profile?.portraitUrl ?? `https://images.evetech.net/characters/${characterId}/portrait?size=128`}
              alt="Character portrait"
              className="h-[80px] w-[80px] shrink-0 rounded object-cover"
              width={80}
              height={80}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold text-zinc-100">{profile?.characterName ?? `Character ${characterId}`}</p>
              <p className="truncate text-xs text-zinc-300">{profile?.corporationName ?? "Corporation unknown"}</p>
              <p className="truncate text-xs text-zinc-400">{profile?.allianceName ?? "No alliance"}</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col rounded bg-zinc-950/50 p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Fittings</h2>
          <input
            className="mb-3 w-full rounded bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
            placeholder="Search fittings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="dark-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {list.groups.map((group) => (
              <div key={group.shipTypeId}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{group.shipTypeName}</h3>
                <ul className="mt-1 space-y-1">
                  {group.fittings.map((fit) => (
                    <li key={fit.fittingId}>
                      <button
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                          selectedId === fit.fittingId ? "bg-zinc-700 text-white" : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                        onClick={() => setSelectedId(fit.fittingId)}
                      >
                        <span className="truncate">{fit.name}</span>
                        <span
                          title={(syncStatusOverrides[fit.fittingId] ?? fit.isSyncedToEve) ? "Synced to EVE" : "Not synced to EVE"}
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                            (syncStatusOverrides[fit.fittingId] ?? fit.isSyncedToEve) ? "bg-emerald-900/70 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {(syncStatusOverrides[fit.fittingId] ?? fit.isSyncedToEve) ? "\u2713" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded bg-zinc-950/60 p-3 shadow-sm">
          <div className="relative">
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-cyan-700 px-3 py-2 text-sm text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={syncAll}
            disabled={syncButtonDisabled}
          >
            {isImporting ? <Spinner className="h-4 w-4 border-cyan-200 border-t-white" /> : null}
            Sync fittings from EVE
          </button>
          {syncCooldownSeconds > 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-zinc-950/65 text-xs font-medium text-zinc-100">
              Retry in {syncCooldownSeconds}s
            </div>
          ) : null}
          </div>
          <p className="mt-2 text-xs text-zinc-400">Last sync: {formatSyncDate(list.updatedAt)}</p>
        </section>
      </aside>

      <main className="min-w-0 flex-1 self-stretch flex flex-col gap-3 rounded bg-zinc-900 p-4">
        {!selectedId || !selectedAvailable ? (
          <p className="text-sm text-zinc-400">Select a fitting from the list.</p>
        ) : isDetailLoading || !detail ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Spinner className="h-4 w-4 border-zinc-500 border-t-zinc-200" />
            Loading fitting details...
          </div>
        ) : (
          <>
            <section className="flex flex-wrap items-start justify-between gap-3 rounded bg-zinc-950/60 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Image
                  src={shipImageUrl ?? `https://images.evetech.net/types/${detail.shipTypeId}/icon?size=128`}
                  alt={`${detail.shipTypeName} ship`}
                  className="h-[72px] w-[72px] rounded object-cover"
                  width={72}
                  height={72}
                  onError={(event) => {
                    event.currentTarget.src = `https://images.evetech.net/types/${detail.shipTypeId}/icon?size=128`;
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-zinc-100">{detail.shipTypeName}</p>
                  <p className="truncate text-sm text-zinc-300">{detail.fittingName}</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="inline-flex cursor-pointer items-center gap-2 rounded bg-red-950/70 px-3 py-1 text-sm text-red-200 transition-colors hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={deletePermanently}
                  disabled={isDeletingPermanently || isDeleting || isSyncingOne || isImporting}
                  title="Permanently delete this fitting"
                >
                  {isDeletingPermanently ? <Spinner className="h-3.5 w-3.5 border-red-400 border-t-red-100" /> : null}
                  Delete permanently
                </button>
                <button
                  className="inline-flex cursor-pointer items-center gap-2 rounded bg-red-900/50 px-3 py-1 text-sm text-red-200 transition-colors hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={removeFromEve}
                  disabled={isDeleting || isDeletingPermanently || isSyncingOne || isImporting || !effectiveCanRemoveFromEve}
                >
                  {isDeleting ? <Spinner className="h-3.5 w-3.5 border-red-400 border-t-red-100" /> : null}
                  Remove from EVE
                </button>
                <button
                  className="inline-flex cursor-pointer items-center gap-2 rounded bg-emerald-900/50 px-3 py-1 text-sm text-emerald-200 transition-colors hover:bg-emerald-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={syncToEve}
                  disabled={isSyncingOne || isDeleting || isDeletingPermanently || isImporting || !effectiveCanSyncToEve}
                >
                  {isSyncingOne ? <Spinner className="h-3.5 w-3.5 border-emerald-400 border-t-emerald-100" /> : null}
                  Sync to EVE
                </button>
              </div>
            </section>
            <section className="min-h-0 flex-1">
              <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
                <div className="min-h-0 rounded bg-zinc-950/70 p-3 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">JSON</h3>
                  <pre className="dark-scrollbar h-[calc(100%-1.5rem)] overflow-auto text-xs text-zinc-200">{prettyJson(detail.fitting)}</pre>
                </div>
                <div className="min-h-0 rounded bg-zinc-950/70 p-3 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">PYFA</h3>
                  {isPyfaLoading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <Spinner className="h-3.5 w-3.5 border-zinc-500 border-t-zinc-200" />
                      Loading PYFA export...
                    </div>
                  ) : (
                    <pre className="dark-scrollbar h-[calc(100%-1.5rem)] overflow-auto whitespace-pre-wrap text-xs text-zinc-200">{pyfa}</pre>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {toasts.length > 0 ? (
        <div className="fixed top-4 left-1/2 z-40 flex w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3">
          {toasts.map((toast) => (
            <p
              key={toast.id}
              className={`rounded px-5 py-3 text-base shadow-lg ${
                toast.tone === "success"
                  ? "bg-emerald-950/80 text-emerald-200"
                  : toast.tone === "warning"
                    ? "bg-amber-950/80 text-amber-200"
                    : "bg-red-950/80 text-red-200"
              }`}
            >
              {toast.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

