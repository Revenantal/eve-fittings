"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  IoChevronDown,
  IoChevronForward,
  IoCloudDownloadOutline,
  IoCloudOutline,
  IoCloudOfflineOutline,
  IoCloudUploadOutline,
  IoClose,
  IoMenu,
  IoOpenOutline,
  IoTrashOutline
} from "react-icons/io5";

type EsiFitting = {
  description: string;
  fitting_id: number;
  items: Array<{
    flag: number | string;
    quantity: number;
    type_id: number;
  }>;
  name: string;
  ship_type_id: number;
};

type FitListResponse = {
  updatedAt: string | null;
  groups: Array<{
    shipClassName: string;
    factions: Array<{
      shipFactionName: string;
      ships: Array<{
        shipTypeId: number;
        shipTypeName: string;
        fittings: Array<{
          fittingId: number;
          name: string;
          isSyncedToEve: boolean;
        }>;
      }>;
    }>;
  }>;
};

type FitDetailResponse = {
  fitting: EsiFitting;
  canRemoveFromEve: boolean;
  canSyncToEve: boolean;
  shipTypeId: number;
  shipTypeName: string;
  fittingName: string;
  itemTypeNames: Record<string, string>;
  itemNamesByFlag: Record<string, string>;
};

type FitPriceResponse = {
  totalIsk: number;
  appraisalUrl: string | null;
  lastModified: string;
};

type FitBundleResponse = {
  detail: FitDetailResponse;
  eft: string;
  price: FitPriceResponse | null;
  lastModified: string | null;
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
type SlotGroup = "high" | "medium" | "low" | "rig" | "other";
type FixedSlotGroup = Exclude<SlotGroup, "other">;
type SlotItemAssignment = {
  item: EsiFitting["items"][number];
  sortIndex: number;
};
type SlotCell = {
  slotGroup: FixedSlotGroup;
  slotNumber: number;
  angleDeg: number;
  radius: number;
  item: EsiFitting["items"][number] | null;
};
type SlotModel = {
  cells: SlotCell[];
  otherItems: EsiFitting["items"];
  filledCounts: Record<FixedSlotGroup, number>;
  totalVisibleItems: number;
};

type PersistedDashboardUiState = {
  selectedId?: number;
  collapsedClasses?: Record<string, boolean>;
  collapsedFactions?: Record<string, boolean>;
  collapsedShips?: Record<string, boolean>;
};

function isNumericText(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

const FIXED_SLOT_COUNTS: Record<FixedSlotGroup, number> = {
  high: 8,
  medium: 8,
  low: 8,
  rig: 3
};

const SLOT_RADIUS: Record<FixedSlotGroup, number> = {
  high: 154,
  medium: 154,
  low: 154,
  rig: 106
};

const SLOT_ICON_SIZE: Record<FixedSlotGroup, number> = {
  high: 30,
  medium: 30,
  low: 30,
  rig: 28
};

const SLOT_GROUP_CENTER_ANGLE: Record<FixedSlotGroup, number> = {
  high: -90,
  medium: 30,
  low: 150,
  rig: 90
};
const DEFAULT_PAGE_TITLE = "EVE Fittings";
const DASHBOARD_UI_STATE_STORAGE_KEY = "eve-fittings-dashboard-ui-v1";
const DASHBOARD_SYNC_OVERRIDES_STORAGE_KEY = "eve-fittings-sync-overrides-v1";
const SIDEBAR_COLLAPSE_BREAKPOINT = 1400;

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

function formatIskCompact(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}t ISK`;
  }
  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b ISK`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}m ISK`;
  }
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k ISK`;
  }
  return `${value.toFixed(2)} ISK`;
}

function formatIskFull(value: number): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(value))} ISK`;
}

function listAllFittings(groups: FitListResponse["groups"] | null | undefined) {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups.flatMap((shipClassGroup) =>
    shipClassGroup.factions.flatMap((factionGroup) =>
      factionGroup.ships.flatMap((shipGroup) =>
        shipGroup.fittings.map((fit) => ({
          ...fit,
          shipTypeId: shipGroup.shipTypeId
        }))
      )
    )
  );
}

function isFitListResponse(value: unknown): value is FitListResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { updatedAt?: unknown; groups?: unknown };
  if (!(candidate.updatedAt === null || typeof candidate.updatedAt === "string")) {
    return false;
  }
  return Array.isArray(candidate.groups);
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-100`}
    />
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded ${className ?? ""}`} />;
}

function DetailSkeleton() {
  return (
    <>
      <section className="rounded bg-zinc-950/60 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-4 max-[900px]:flex-col max-[900px]:items-center">
          <SkeletonBlock className="h-[352px] w-[352px] rounded-full" />
          <div className="min-w-0 flex-1 space-y-3 pl-0 text-center md:pl-6 md:text-left">
            <SkeletonBlock className="h-8 w-2/3" />
            <SkeletonBlock className="h-5 w-1/3" />
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-3 w-1/3" />
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-8 w-36" />
              <SkeletonBlock className="h-8 w-32" />
              <SkeletonBlock className="h-8 w-28" />
            </div>
          </div>
        </div>
      </section>
      <section className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
          <SkeletonBlock className="h-full min-h-[220px]" />
          <SkeletonBlock className="h-full min-h-[220px]" />
        </div>
      </section>
    </>
  );
}

function FittingWheelSkeleton() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-zinc-900/72 backdrop-blur-[1px]">
      <div className="relative h-[352px] w-[352px]">
        <SkeletonBlock className="absolute inset-0 rounded-full" />
        <SkeletonBlock className="absolute top-1/2 left-1/2 h-[258px] w-[258px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}

function toSlotGroup(flag: number | string): SlotGroup {
  if (typeof flag !== "string") {
    return "other";
  }
  if (flag.startsWith("HiSlot")) {
    return "high";
  }
  if (flag.startsWith("MedSlot")) {
    return "medium";
  }
  if (flag.startsWith("LoSlot")) {
    return "low";
  }
  if (flag.startsWith("RigSlot")) {
    return "rig";
  }
  return "other";
}

function toSlotSortIndex(flag: number | string): number {
  if (typeof flag !== "string") {
    return Number.MAX_SAFE_INTEGER;
  }
  const slotMatch = flag.match(/(HiSlot|MedSlot|LoSlot|RigSlot)(\d+)$/);
  if (!slotMatch) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Number(slotMatch[2]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function buildArcAngles(count: number, center: number, radius: number, iconSize: number): number[] {
  if (count <= 1) {
    return [center];
  }
  const iconGapPx = 5;
  const stepDeg = (((iconSize + iconGapPx) / radius) * 180) / Math.PI;
  const span = stepDeg * (count - 1);
  const start = center - span / 2;
  return Array.from({ length: count }, (_, index) => start + stepDeg * index);
}

export function Dashboard({ characterId, csrfToken }: DashboardProps) {
  const fittingsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [list, setList] = useState<FitListResponse>({ updatedAt: null, groups: [] });
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FitDetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [eft, setEft] = useState<string>("");
  const [estimatedTotalIsk, setEstimatedTotalIsk] = useState<number | null>(null);
  const [estimatedAppraisalUrl, setEstimatedAppraisalUrl] = useState<string | null>(null);
  const [estimatedLastModified, setEstimatedLastModified] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isEftLoading, setIsEftLoading] = useState(false);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(false);
  const [showDetailSkeleton, setShowDetailSkeleton] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showInitialImportOverlay, setShowInitialImportOverlay] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [isSyncingOne, setIsSyncingOne] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncStatusOverrides, setSyncStatusOverrides] = useState<SyncStatusOverrides>({});
  const [syncCooldownSeconds, setSyncCooldownSeconds] = useState(0);
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});
  const [collapsedFactions, setCollapsedFactions] = useState<Record<string, boolean>>({});
  const [collapsedShips, setCollapsedShips] = useState<Record<string, boolean>>({});
  const [isCompactSidebar, setIsCompactSidebar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const actionBusy = isImporting || isDeleting || isDeletingPermanently || isSyncingOne || isLoggingOut;
  const syncButtonDisabled = actionBusy || syncCooldownSeconds > 0;
  const shipImageUrl = detail ? `https://images.evetech.net/types/${detail.shipTypeId}/render?size=512` : null;
  const selectedSyncOverride = selectedId ? syncStatusOverrides[selectedId] : undefined;
  const selectedIsSyncedToEve = detail ? selectedSyncOverride ?? detail.canRemoveFromEve : false;
  const effectiveCanRemoveFromEve = Boolean(detail && selectedIsSyncedToEve);
  const effectiveCanSyncToEve = Boolean(detail && !selectedIsSyncedToEve);
  const itemTypeNames = detail?.itemTypeNames ?? {};
  const itemNamesByFlag = detail?.itemNamesByFlag ?? {};
  const isInitialListLoading = isListLoading && list.groups.length === 0;
  const isWheelRefreshing =
    isDetailLoading && selectedId !== null && detail !== null && detail.fitting.fitting_id !== selectedId;
  const isInitialImporting = isImporting && showInitialImportOverlay;
  const slotModel = useMemo<SlotModel>(
    () => {
      if (!detail) {
        return {
          cells: [],
          otherItems: [],
          filledCounts: { high: 0, medium: 0, low: 0, rig: 0 },
          totalVisibleItems: 0
        };
      }

      const assignedByGroup: Record<FixedSlotGroup, Array<SlotItemAssignment | null>> = {
        high: Array.from({ length: FIXED_SLOT_COUNTS.high }, () => null),
        medium: Array.from({ length: FIXED_SLOT_COUNTS.medium }, () => null),
        low: Array.from({ length: FIXED_SLOT_COUNTS.low }, () => null),
        rig: Array.from({ length: FIXED_SLOT_COUNTS.rig }, () => null)
      };
      const overflowByGroup: Record<FixedSlotGroup, SlotItemAssignment[]> = {
        high: [],
        medium: [],
        low: [],
        rig: []
      };
      const otherItems: EsiFitting["items"] = [];

      for (const item of detail.fitting.items) {
        const group = toSlotGroup(item.flag);
        if (group === "other") {
          otherItems.push(item);
          continue;
        }
        const slotIndex = toSlotSortIndex(item.flag);
        const assignment: SlotItemAssignment = { item, sortIndex: slotIndex };
        if (slotIndex >= 0 && slotIndex < FIXED_SLOT_COUNTS[group] && assignedByGroup[group][slotIndex] === null) {
          assignedByGroup[group][slotIndex] = assignment;
        } else {
          overflowByGroup[group].push(assignment);
        }
      }

      for (const group of ["high", "medium", "low", "rig"] as const) {
        overflowByGroup[group].sort((left, right) => left.sortIndex - right.sortIndex);
        for (const assignment of overflowByGroup[group]) {
          const firstEmptyIndex = assignedByGroup[group].findIndex((entry) => entry === null);
          if (firstEmptyIndex === -1) {
            otherItems.push(assignment.item);
            continue;
          }
          assignedByGroup[group][firstEmptyIndex] = assignment;
        }
      }

      const cells: SlotCell[] = [];
      for (const group of ["high", "medium", "low", "rig"] as const) {
        const angles = buildArcAngles(
          FIXED_SLOT_COUNTS[group],
          SLOT_GROUP_CENTER_ANGLE[group],
          SLOT_RADIUS[group],
          SLOT_ICON_SIZE[group]
        );
        for (let slotNumber = 0; slotNumber < FIXED_SLOT_COUNTS[group]; slotNumber += 1) {
          cells.push({
            slotGroup: group,
            slotNumber,
            angleDeg: angles[slotNumber],
            radius: SLOT_RADIUS[group],
            item: assignedByGroup[group][slotNumber]?.item ?? null
          });
        }
      }

      const filledCounts = {
        high: assignedByGroup.high.filter(Boolean).length,
        medium: assignedByGroup.medium.filter(Boolean).length,
        low: assignedByGroup.low.filter(Boolean).length,
        rig: assignedByGroup.rig.filter(Boolean).length
      };

      return {
        cells,
        otherItems,
        filledCounts,
        totalVisibleItems: filledCounts.high + filledCounts.medium + filledCounts.low + filledCounts.rig + otherItems.length
      };
    },
    [detail]
  );

  function addToast(text: string, tone: Toast["tone"]) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

  const selectedAvailable = useMemo(
    () => (selectedId ? listAllFittings(list.groups).some((fit) => fit.fittingId === selectedId) : false),
    [list.groups, selectedId]
  );

  useEffect(() => {
    if (selectedId && !selectedAvailable) {
      setDetail(null);
      setDetailError(null);
      setEstimatedTotalIsk(null);
      setEstimatedAppraisalUrl(null);
      setEstimatedLastModified(null);
    }
  }, [selectedId, selectedAvailable]);

  function toggleCollapsed(
    key: string,
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) {
    setter((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }

  function isCollapsed(state: Record<string, boolean>, key: string): boolean {
    return state[key] !== false;
  }

  function setAllCollapsed(nextCollapsed: boolean) {
    const nextClasses: Record<string, boolean> = {};
    const nextFactions: Record<string, boolean> = {};
    const nextShips: Record<string, boolean> = {};

    for (const shipClassGroup of list.groups) {
      const classKey = shipClassGroup.shipClassName;
      nextClasses[classKey] = nextCollapsed;
      for (const factionGroup of shipClassGroup.factions) {
        const factionKey = `${classKey}::${factionGroup.shipFactionName}`;
        nextFactions[factionKey] = nextCollapsed;
        for (const shipGroup of factionGroup.ships) {
          const shipKey = `${factionKey}::${shipGroup.shipTypeId}`;
          nextShips[shipKey] = nextCollapsed;
        }
      }
    }

    setCollapsedClasses(nextClasses);
    setCollapsedFactions(nextFactions);
    setCollapsedShips(nextShips);
  }

  function parseSelectedIdFromUrl(): number | null {
    if (typeof window === "undefined") {
      return null;
    }
    const value = new URL(window.location.href).searchParams.get("id");
    if (!value || !/^\d+$/.test(value)) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseQueryFromUrl(): string {
    if (typeof window === "undefined") {
      return "";
    }
    return new URL(window.location.href).searchParams.get("q") ?? "";
  }

  async function loadProfile() {
    setIsProfileLoading(true);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as ProfileResponse;
      setProfile(data);
    } finally {
      setIsProfileLoading(false);
    }
  }

  async function loadList(nextQuery: string, options?: { bypassCache?: boolean }) {
    setIsListLoading(true);
    try {
      const response = await fetch(`/api/fits?q=${encodeURIComponent(nextQuery)}`, {
        cache: options?.bypassCache ? "no-store" : "default"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string } | unknown;
      if (!response.ok) {
        const apiError = (payload as { error?: unknown })?.error;
        const message = typeof apiError === "string" ? apiError : "Unable to load fittings.";
        addToast(message, "error");
        setList({ updatedAt: null, groups: [] });
        setSelectedId(null);
        return;
      }
      if (!isFitListResponse(payload)) {
        addToast("Unable to load fittings.", "error");
        setList({ updatedAt: null, groups: [] });
        setSelectedId(null);
        return;
      }
      const data = payload;
      setList(data);
      const allFittings = listAllFittings(data.groups);
      const availableIds = new Set(allFittings.map((fit) => fit.fittingId));
      setSelectedId((prev) => {
        if (prev !== null && availableIds.has(prev)) {
          return prev;
        }
        return allFittings.length > 0 ? allFittings[0].fittingId : null;
      });
    } finally {
      setIsListLoading(false);
    }
  }

  async function loadBundle(fittingId: number, options?: { bypassCache?: boolean }) {
    setIsDetailLoading(true);
    setIsEftLoading(true);
    setIsPriceLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/fits/${fittingId}/bundle`, {
        cache: options?.bypassCache ? "no-store" : "default"
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setDetailError(typeof data.error === "string" ? data.error : "Unable to load fitting details.");
        setDetail(null);
        setEft("Unable to load EFT format.");
        setEstimatedTotalIsk(null);
        setEstimatedAppraisalUrl(null);
        setEstimatedLastModified(null);
        return;
      }
      const data = (await response.json()) as FitBundleResponse;
      setDetail(data.detail);
      setEft(typeof data.eft === "string" ? data.eft : "Unable to load EFT format.");
      const fallbackLastModified = typeof data.lastModified === "string" ? data.lastModified : null;
      if (data.price) {
        setEstimatedTotalIsk(typeof data.price.totalIsk === "number" ? data.price.totalIsk : null);
        setEstimatedAppraisalUrl(typeof data.price.appraisalUrl === "string" ? data.price.appraisalUrl : null);
        setEstimatedLastModified(
          typeof data.price.lastModified === "string" ? data.price.lastModified : fallbackLastModified
        );
      } else {
        setEstimatedTotalIsk(null);
        setEstimatedAppraisalUrl(null);
        setEstimatedLastModified(fallbackLastModified);
      }
    } finally {
      setIsDetailLoading(false);
      setIsEftLoading(false);
      setIsPriceLoading(false);
    }
  }

  async function copyEftToClipboard() {
    if (!eft.trim()) {
      addToast("No EFT fitting to copy.", "warning");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      addToast("Clipboard is not available in this browser.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(eft);
      addToast("EFT fitting copied to clipboard.", "success");
    } catch {
      addToast("Failed to copy EFT fitting.", "error");
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
    const isFirstImport = list.updatedAt === null && list.groups.length === 0;
    setShowInitialImportOverlay(isFirstImport);
    setIsImporting(true);
    try {
      const result = await postJson("/api/fits/sync");
      setSyncStatusOverrides({});
      setSyncCooldownSeconds(0);
      await loadList(query, { bypassCache: true });
      if (selectedId) {
        await loadBundle(selectedId, { bypassCache: true });
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
      setShowInitialImportOverlay(false);
    }
  }

  async function removeFromEve() {
    if (!selectedId || !confirm("Remove this fitting from EVE?") || !effectiveCanRemoveFromEve) {
      return;
    }
    setIsDeleting(true);
    try {
      const result = await postJson(`/api/fits/${selectedId}/remove`, { confirm: true });
      await loadList(query, { bypassCache: true });
      await loadBundle(selectedId, { bypassCache: true });
      if (result.stale) {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: false }));
        addToast("Fitting removed from EVE, but refresh failed. Data may be stale.", "warning");
      } else {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: false }));
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
      await loadList(query, { bypassCache: true });
      await loadBundle(selectedId, { bypassCache: true });
      if (result.stale) {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: true }));
        addToast("Fitting imported to EVE, but refresh failed. Data may be stale.", "warning");
      } else {
        setSyncStatusOverrides((prev) => ({ ...prev, [selectedId]: true }));
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
      setDetailError(null);
      setEft("");
      setEstimatedTotalIsk(null);
      setEstimatedAppraisalUrl(null);
      setEstimatedLastModified(null);
      setSelectedId(null);
      await loadList(query, { bypassCache: true });
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
    if (typeof window === "undefined") {
      return;
    }

    const fromUrl = parseSelectedIdFromUrl();
    const queryFromUrl = parseQueryFromUrl();
    if (queryFromUrl) {
      setQuery(queryFromUrl);
    }
    if (fromUrl !== null) {
      setSelectedId(fromUrl);
    }

    try {
      const raw = window.localStorage.getItem(DASHBOARD_UI_STATE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedDashboardUiState;
      if (parsed.collapsedClasses && typeof parsed.collapsedClasses === "object") {
        setCollapsedClasses(parsed.collapsedClasses);
      }
      if (parsed.collapsedFactions && typeof parsed.collapsedFactions === "object") {
        setCollapsedFactions(parsed.collapsedFactions);
      }
      if (parsed.collapsedShips && typeof parsed.collapsedShips === "object") {
        setCollapsedShips(parsed.collapsedShips);
      }
      if (fromUrl === null && typeof parsed.selectedId === "number" && Number.isFinite(parsed.selectedId)) {
        setSelectedId(parsed.selectedId);
      }
    } catch {
      // Ignore invalid persisted UI state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(DASHBOARD_SYNC_OVERRIDES_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as SyncStatusOverrides;
      if (parsed && typeof parsed === "object") {
        setSyncStatusOverrides(parsed);
      }
    } catch {
      // Ignore invalid persisted sync override state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextState: PersistedDashboardUiState = {
      selectedId: selectedId ?? undefined,
      collapsedClasses,
      collapsedFactions,
      collapsedShips
    };
    window.localStorage.setItem(DASHBOARD_UI_STATE_STORAGE_KEY, JSON.stringify(nextState));
  }, [selectedId, collapsedClasses, collapsedFactions, collapsedShips]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(DASHBOARD_SYNC_OVERRIDES_STORAGE_KEY, JSON.stringify(syncStatusOverrides));
  }, [syncStatusOverrides]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadList(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void loadBundle(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (selectedId) {
      url.searchParams.set("id", String(selectedId));
    } else {
      url.searchParams.delete("id");
    }
    if (query.trim()) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedId, query]);

  useEffect(() => {
    if (syncCooldownSeconds <= 0) {
      return;
    }
    const handle = window.setInterval(() => {
      setSyncCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [syncCooldownSeconds]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.title = detail?.fittingName ? `${detail.fittingName} | ${DEFAULT_PAGE_TITLE}` : DEFAULT_PAGE_TITLE;
  }, [detail?.fittingName]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(`(max-width: ${SIDEBAR_COLLAPSE_BREAKPOINT}px)`);
    const applyLayout = (isCompact: boolean) => {
      setIsCompactSidebar(isCompact);
      setIsSidebarOpen(!isCompact);
    };

    applyLayout(media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      applyLayout(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isCompactSidebar || !isSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCompactSidebar, isSidebarOpen]);

  useEffect(() => {
    if (!isInitialListLoading) {
      setShowInitialSkeleton(false);
      return;
    }
    const handle = window.setTimeout(() => {
      setShowInitialSkeleton(true);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [isInitialListLoading]);

  useEffect(() => {
    if (!(isDetailLoading && !detail)) {
      setShowDetailSkeleton(false);
      return;
    }
    const handle = window.setTimeout(() => {
      setShowDetailSkeleton(true);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [isDetailLoading, detail]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let classKeyToExpand: string | null = null;
    let factionKeyToExpand: string | null = null;
    let shipKeyToExpand: string | null = null;

    for (const shipClassGroup of list.groups) {
      const classKey = shipClassGroup.shipClassName;
      for (const factionGroup of shipClassGroup.factions) {
        const factionKey = `${classKey}::${factionGroup.shipFactionName}`;
        for (const shipGroup of factionGroup.ships) {
          if (shipGroup.fittings.some((fit) => fit.fittingId === selectedId)) {
            classKeyToExpand = classKey;
            factionKeyToExpand = factionKey;
            shipKeyToExpand = `${factionKey}::${shipGroup.shipTypeId}`;
            break;
          }
        }
        if (shipKeyToExpand) {
          break;
        }
      }
      if (shipKeyToExpand) {
        break;
      }
    }

    if (!classKeyToExpand || !factionKeyToExpand || !shipKeyToExpand) {
      return;
    }

    setCollapsedClasses((prev) => (prev[classKeyToExpand!] === false ? prev : { ...prev, [classKeyToExpand!]: false }));
    setCollapsedFactions((prev) =>
      prev[factionKeyToExpand!] === false ? prev : { ...prev, [factionKeyToExpand!]: false }
    );
    setCollapsedShips((prev) => (prev[shipKeyToExpand!] === false ? prev : { ...prev, [shipKeyToExpand!]: false }));
  }, [selectedId, list.groups]);

  useEffect(() => {
    if (!selectedId || isInitialListLoading) {
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      const container = fittingsScrollContainerRef.current;
      const target = container?.querySelector<HTMLButtonElement>(`button[data-fit-id="${selectedId}"]`);
      if (!target) {
        return;
      }
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(handle);
  }, [selectedId, isInitialListLoading, collapsedClasses, collapsedFactions, collapsedShips]);

  function selectFitting(fittingId: number) {
    setSelectedId(fittingId);
    if (isCompactSidebar) {
      setIsSidebarOpen(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 w-full items-start gap-4 p-4">
      {isInitialImporting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded bg-zinc-900 px-4 py-3 text-zinc-100 shadow-xl">
            <Spinner className="h-5 w-5 border-zinc-600 border-t-cyan-400" />
            <p className="text-sm">Importing EVE fits...</p>
          </div>
        </div>
      ) : null}

      {isCompactSidebar ? (
        <>
          <button
            type="button"
            className="fixed top-6 left-6 z-40 inline-flex h-10 items-center justify-center gap-2 rounded bg-zinc-950/90 px-3 text-xs font-medium text-zinc-100 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-900"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-expanded={isSidebarOpen}
            aria-controls="fittings-sidebar"
          >
            {isSidebarOpen ? (
              "Close sidebar"
            ) : (
              <>
                <IoMenu className="h-4 w-4" aria-hidden="true" />
                <span>Open Fittings Browser</span>
              </>
            )}
          </button>
          {isSidebarOpen ? (
            <button
              type="button"
              aria-label="Close sidebar"
              className="fixed inset-0 z-30 bg-zinc-950/65"
              onClick={() => setIsSidebarOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      <aside
        id="fittings-sidebar"
        className={`flex flex-col gap-3 rounded bg-zinc-900 p-3 ${
          isCompactSidebar
            ? `fixed inset-y-4 left-4 z-40 h-auto max-h-[calc(100vh-2rem)] w-[min(400px,calc(100vw-2rem))] transition-transform duration-200 ease-out shadow-2xl ${
                isSidebarOpen ? "translate-x-0" : "-translate-x-[112%] pointer-events-none"
              }`
            : "sticky top-4 h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-[400px] shrink-0"
        }`}
      >
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
            {isProfileLoading && !profile && showInitialSkeleton && !isInitialImporting ? (
              <>
                <SkeletonBlock className="h-[80px] w-[80px] shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-full" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
              </>
            ) : (
              <>
                <Image
                  src={profile?.portraitUrl ?? `https://images.evetech.net/characters/${characterId}/portrait?size=128`}
                  alt="Character portrait"
                  className="h-[80px] w-[80px] shrink-0 rounded object-cover"
                  width={80}
                  height={80}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {profile?.characterName ?? `Character ${characterId}`}
                  </p>
                  <p className="truncate text-xs text-zinc-300">{profile?.corporationName ?? "Corporation unknown"}</p>
                  <p className="truncate text-xs text-zinc-400">{profile?.allianceName ?? "No alliance"}</p>
                </div>
              </>
            )}
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
          <div ref={fittingsScrollContainerRef} className="dark-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {isInitialListLoading && showInitialSkeleton && !isInitialImporting ? (
              <div className="space-y-2">
                {Array.from({ length: 14 }, (_, index) => (
                  <SkeletonBlock key={index} className="h-7 w-full" />
                ))}
              </div>
            ) : (
              list.groups.map((shipClassGroup) => (
              <div key={shipClassGroup.shipClassName} className="space-y-1">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-semibold text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                  onClick={() => toggleCollapsed(shipClassGroup.shipClassName, setCollapsedClasses)}
                >
                  {isCollapsed(collapsedClasses, shipClassGroup.shipClassName) ? (
                    <IoChevronForward className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <IoChevronDown className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>{shipClassGroup.shipClassName}</span>
                </button>
                {isCollapsed(collapsedClasses, shipClassGroup.shipClassName) ? null : (
                <div className="ml-2 space-y-1 pl-2">
                  {shipClassGroup.factions.map((factionGroup) => (
                    <div key={`${shipClassGroup.shipClassName}-${factionGroup.shipFactionName}`} className="space-y-1">
                      {(() => {
                        const factionKey = `${shipClassGroup.shipClassName}::${factionGroup.shipFactionName}`;
                        return (
                          <>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-semibold text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                        onClick={() => toggleCollapsed(factionKey, setCollapsedFactions)}
                      >
                        {isCollapsed(collapsedFactions, factionKey) ? (
                          <IoChevronForward className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <IoChevronDown className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{factionGroup.shipFactionName}</span>
                      </button>
                      {isCollapsed(collapsedFactions, factionKey) ? null : (
                      <div className="ml-2 space-y-1 pl-2">
                        {factionGroup.ships.map((shipGroup) => (
                          <div key={shipGroup.shipTypeId} className="space-y-1">
                            {(() => {
                              const shipKey = `${factionKey}::${shipGroup.shipTypeId}`;
                              return (
                                <>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-semibold text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300"
                              onClick={() => toggleCollapsed(shipKey, setCollapsedShips)}
                            >
                              {isCollapsed(collapsedShips, shipKey) ? (
                                <IoChevronForward className="h-3 w-3 shrink-0" aria-hidden="true" />
                              ) : (
                                <IoChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                              )}
                              <span className="truncate">{shipGroup.shipTypeName}</span>
                            </button>
                            {isCollapsed(collapsedShips, shipKey) ? null : (
                            <ul className="ml-2 space-y-1 pl-2">
                              {shipGroup.fittings.map((fit) => (
                                <li key={fit.fittingId}>
                                  {(() => {
                                    const isSynced = syncStatusOverrides[fit.fittingId] ?? fit.isSyncedToEve;
                                    return (
                                  <button
                                    data-fit-id={fit.fittingId}
                                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                                      selectedId === fit.fittingId ? "bg-zinc-700 text-white" : "text-zinc-300 hover:bg-zinc-800"
                                    }`}
                                    onClick={() => selectFitting(fit.fittingId)}
                                  >
                                    <span className="truncate">{fit.name}</span>
                                    <span
                                      title={isSynced ? "Synced to EVE" : "Not synced to EVE"}
                                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                                        isSynced
                                          ? "bg-emerald-900/70 text-emerald-300"
                                          : "bg-red-950/70 text-red-300"
                                      }`}
                                    >
                                      {isSynced ? (
                                        <IoCloudOutline className="h-3 w-3" aria-hidden="true" />
                                      ) : (
                                        <IoCloudOfflineOutline className="h-3 w-3 opacity-70" aria-hidden="true" />
                                      )}
                                    </span>
                                  </button>
                                    );
                                  })()}
                                </li>
                              ))}
                            </ul>
                            )}
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                )}
              </div>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 pt-2">
            <button
              type="button" 
              onClick={() => setAllCollapsed(true)}
              disabled={isInitialListLoading}
              className="inline-flex cursor-pointer items-center rounded bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={() => setAllCollapsed(false)}
              disabled={isInitialListLoading}
              className="inline-flex cursor-pointer items-center rounded bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Expand all
            </button>
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
            {!isImporting ? <IoCloudDownloadOutline className="h-4 w-4" aria-hidden="true" /> : null}
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
        {isInitialListLoading && showInitialSkeleton && !isInitialImporting ? (
          <DetailSkeleton />
        ) : isInitialListLoading ? (
          <div className="min-h-[220px]" />
        ) : !selectedId || !selectedAvailable ? (
          <p className="text-sm text-zinc-400">Select a fitting from the list.</p>
        ) : isDetailLoading && !detail && showDetailSkeleton ? (
          <DetailSkeleton />
        ) : isDetailLoading && !detail ? (
          <div className="min-h-[220px]" />
        ) : detailError ? (
          <div className="rounded bg-red-950/40 px-3 py-2 text-sm text-red-200">{detailError}</div>
        ) : !detail ? (
          <p className="text-sm text-zinc-400">Unable to load fitting details.</p>
        ) : (
          <>
            <section className="rounded bg-zinc-950/60 p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-center gap-4 max-[900px]:flex-col max-[900px]:items-center">
                <div className="relative h-[352px] w-[352px] shrink-0 rounded-full bg-zinc-800/40">
                  {isWheelRefreshing ? <FittingWheelSkeleton /> : null}
                  <div className="absolute top-1/2 left-1/2 h-[258px] w-[258px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-900/70">
                    <Image
                      src={shipImageUrl ?? `https://images.evetech.net/types/${detail.shipTypeId}/icon?size=256`}
                      alt={`${detail.shipTypeName} ship`}
                      className="h-full w-full object-cover"
                      width={258}
                      height={258}
                      onError={(event) => {
                        event.currentTarget.src = `https://images.evetech.net/types/${detail.shipTypeId}/icon?size=256`;
                      }}
                    />
                  </div>
                  {slotModel.cells.map((cell) => {
                    const iconSize = SLOT_ICON_SIZE[cell.slotGroup];
                    const isRig = cell.slotGroup === "rig";
                    const angleRadians = (cell.angleDeg * Math.PI) / 180;
                    const x = isRig ? (cell.slotNumber - 1) * 31 : Math.cos(angleRadians) * cell.radius;
                    const y = isRig ? 92 : Math.sin(angleRadians) * cell.radius;
                    const rotation = isRig ? 0 : cell.angleDeg + 90;
                    return (
                      <div
                        key={`${cell.slotGroup}-${cell.slotNumber}`}
                        className="absolute flex items-center justify-center rounded-[2px] bg-zinc-950/92"
                        style={{
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
                          width: `${iconSize}px`,
                          height: `${iconSize}px`
                        }}
                        title={
                          cell.item
                            ? (() => {
                                const byFlag =
                                  typeof cell.item.flag === "string" ? itemNamesByFlag[cell.item.flag] : undefined;
                                const byTypeId = itemTypeNames[String(cell.item.type_id)];
                                const candidate = byFlag ?? byTypeId ?? "";
                                return candidate && !isNumericText(candidate) ? candidate : "Unknown item";
                              })()
                            : `${cell.slotGroup} ${cell.slotNumber + 1} | empty`
                        }
                      >
                        {cell.item ? (
                          <Image
                            src={`https://images.evetech.net/types/${cell.item.type_id}/icon?size=64`}
                            alt={`Item ${cell.item.type_id}`}
                            className="h-full w-full object-cover"
                            width={64}
                            height={64}
                            style={isRig ? undefined : { transform: `rotate(${-rotation}deg)` }}
                          />
                        ) : (
                          <IoClose
                            className="h-3 w-3 text-zinc-500"
                            aria-hidden="true"
                            style={isRig ? undefined : { transform: `rotate(${-rotation}deg)` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="min-w-0 flex-1 self-center space-y-3 pl-0 text-center md:pl-6 md:text-left">
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-semibold text-zinc-100">{detail.fittingName}</p>
                    <p className="mt-1 truncate text-base text-zinc-300">{detail.shipTypeName}</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {isPriceLoading ? (
                        <span className="inline-flex items-center gap-2 text-zinc-400">
                          <SkeletonBlock className="h-4 w-28" />
                        </span>
                      ) : estimatedTotalIsk !== null ? (
                        <span className="inline-flex items-center gap-2">
                          <span title={formatIskFull(estimatedTotalIsk)}>{formatIskCompact(estimatedTotalIsk)}</span>
                          {estimatedAppraisalUrl ? (
                            <a
                              href={estimatedAppraisalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Janice appraisal"
                              aria-label="Open Janice appraisal"
                              className="inline-flex h-4 w-4 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-200"
                            >
                              <IoOpenOutline className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Cost unavailable</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {estimatedLastModified ? `Backed up: ${formatSyncDate(estimatedLastModified)}` : "Backed up: unknown"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex cursor-pointer items-center gap-2 rounded bg-red-950/70 px-3 py-1 text-sm text-red-200 transition-colors hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={deletePermanently}
                      disabled={isDeletingPermanently || isDeleting || isSyncingOne || isImporting}
                      title="Delete backup file"
                    >
                      {isDeletingPermanently ? <Spinner className="h-3.5 w-3.5 border-red-400 border-t-red-100" /> : null}
                      {!isDeletingPermanently ? <IoTrashOutline className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      Delete Backup File
                    </button>
                    <button
                      className="inline-flex cursor-pointer items-center gap-2 rounded bg-red-900/50 px-3 py-1 text-sm text-red-200 transition-colors hover:bg-red-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={removeFromEve}
                      disabled={isDeleting || isDeletingPermanently || isSyncingOne || isImporting || !effectiveCanRemoveFromEve}
                    >
                      {isDeleting ? <Spinner className="h-3.5 w-3.5 border-red-400 border-t-red-100" /> : null}
                      {!isDeleting ? <IoCloudOfflineOutline className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      Remove from EVE
                    </button>
                    <button
                      className="inline-flex cursor-pointer items-center gap-2 rounded bg-emerald-900/50 px-3 py-1 text-sm text-emerald-200 transition-colors hover:bg-emerald-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={syncToEve}
                      disabled={isSyncingOne || isDeleting || isDeletingPermanently || isImporting || !effectiveCanSyncToEve}
                    >
                      {isSyncingOne ? <Spinner className="h-3.5 w-3.5 border-emerald-400 border-t-emerald-100" /> : null}
                      {!isSyncingOne ? <IoCloudUploadOutline className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      Sync to EVE
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <section className="min-h-0 flex-1">
              <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
                <div className="min-h-0 rounded bg-zinc-950/70 p-3 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Description</h3>
                  <div
                    className="dark-scrollbar h-[calc(100%-1.5rem)] overflow-y-auto pr-1 text-sm text-zinc-300 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: detail.fitting.description?.trim() ? detail.fitting.description : "No description."
                    }}
                  />
                </div>
                <div className="min-h-0 rounded bg-zinc-950/70 p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">EFT</h3>
                    <button
                      type="button"
                      onClick={copyEftToClipboard}
                      disabled={isEftLoading || !eft.trim()}
                      aria-label="Copy EFT fitting"
                      title="Copy EFT fitting"
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-zinc-900/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                  {isEftLoading ? (
                    <div className="space-y-2">
                      <SkeletonBlock className="h-3 w-full" />
                      <SkeletonBlock className="h-3 w-5/6" />
                      <SkeletonBlock className="h-3 w-4/6" />
                      <SkeletonBlock className="h-3 w-3/6" />
                    </div>
                  ) : (
                    <pre className="dark-scrollbar h-[calc(100%-1.5rem)] overflow-auto whitespace-pre-wrap text-xs text-zinc-200">{eft}</pre>
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

