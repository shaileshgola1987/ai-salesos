"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { LeadDto, UserDto, VisitDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { getCurrentCoordinates, GeolocationError } from "@/lib/geolocation";
import { flushQueuedCheckIns, getQueuedCheckIns, queueCheckIn, type QueuedCheckIn } from "@/lib/offline-visit-queue";

function mapsLink(lat: string, lng: string): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function VisitsPage() {
  return (
    <Suspense fallback={null}>
      <VisitsPageInner />
    </Suspense>
  );
}

function VisitsPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedLeadId = searchParams.get("leadId") ?? "";

  const [visits, setVisits] = useState<VisitDto[] | null>(null);
  const [queued, setQueued] = useState<QueuedCheckIn[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "">("");
  const [userFilter, setUserFilter] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isManager =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "SALES_MANAGER";

  const loadVisits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (userFilter) params.set("userId", userFilter);
      const query = params.toString();
      const data = await apiFetch<VisitDto[]>(`/visits${query ? `?${query}` : ""}`);
      setVisits(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load visits");
    }
  }, [statusFilter, userFilter]);

  const loadQueued = useCallback(async () => {
    try {
      setQueued(await getQueuedCheckIns());
    } catch {
      // IndexedDB unavailable (private browsing, older browser) — offline queueing simply
      // won't work there; online check-in still does.
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await flushQueuedCheckIns();
    } catch {
      // still offline — nothing to do, the next online event or manual retry will catch up
    } finally {
      await loadQueued();
      void loadVisits();
      setSyncing(false);
    }
  }, [loadQueued, loadVisits]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter change -> refetch
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial queued check-ins read
    void loadQueued();
  }, [loadQueued]);

  useEffect(() => {
    void Promise.all([
      apiFetch<LeadDto[]>("/leads").then(setLeads),
      isManager ? apiFetch<UserDto[]>("/users").then(setUsers) : Promise.resolve(),
    ]).catch(() => undefined);
  }, [isManager]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser API's current value on mount
    setIsOnline(navigator.onLine);
    function onOnline() {
      setIsOnline(true);
      void sync();
    }
    function onOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) void sync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount, sync() is stable enough for this
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Field Visits</h2>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-1 font-medium ${
                isOnline
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
            {queued.length > 0 && (
              <button
                onClick={() => void sync()}
                disabled={syncing || !isOnline}
                className="rounded-full border border-zinc-300 px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                {syncing ? "Syncing…" : `${queued.length} pending — sync now`}
              </button>
            )}
          </div>
        </div>

        <CheckInForm
          leads={leads}
          preselectedLeadId={preselectedLeadId}
          onCheckedIn={() => {
            void loadVisits();
            void loadQueued();
          }}
        />

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "open" | "closed" | "")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All visits</option>
            <option value="open">Checked in</option>
            <option value="closed">Checked out</option>
          </select>
          {isManager && (
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-2">
          {queued.map((q) => (
            <div
              key={`queued-${q.id}`}
              className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950"
            >
              <p className="font-medium text-amber-800 dark:text-amber-300">{q.payload.purpose}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Queued offline at {new Date(q.queuedAt).toLocaleString()} — will sync automatically.
              </p>
            </div>
          ))}

          {visits?.map((visit) => (
            <VisitRow
              key={visit.id}
              visit={visit}
              canCheckOut={!visit.checkOutAt && (visit.userId === user?.id || isManager)}
              onCheckedOut={() => void loadVisits()}
            />
          ))}

          {visits && visits.length === 0 && queued.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
              No visits logged yet.
            </p>
          )}
          {!visits && !error && <p className="text-sm text-zinc-500">Loading visits…</p>}
        </div>
      </div>
    </AppShell>
  );
}

function CheckInForm({
  leads,
  preselectedLeadId,
  onCheckedIn,
}: {
  leads: LeadDto[];
  preselectedLeadId: string;
  onCheckedIn: () => void;
}) {
  const [leadId, setLeadId] = useState(preselectedLeadId);
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!purpose.trim()) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const coords = await getCurrentCoordinates();
      const payload = {
        leadId: leadId || undefined,
        purpose,
        notes: notes || undefined,
        lat: coords.lat,
        lng: coords.lng,
      };
      const clientId =
        typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

      try {
        await apiFetch("/visits/check-in", {
          method: "POST",
          body: JSON.stringify({ ...payload, clientId }),
        });
      } catch (err) {
        if (err instanceof ApiError) throw err; // a real error from the server — surface it
        // fetch itself failed (no network) — queue for later instead of losing the check-in
        await queueCheckIn(payload, clientId);
        setInfo("You're offline — this check-in was saved and will sync automatically.");
      }

      setPurpose("");
      setNotes("");
      onCheckedIn();
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to check in");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Check in</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">No linked lead</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Purpose (e.g. Follow-up, Demo, Collection)"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {info && <p className="text-sm text-amber-600 dark:text-amber-400">{info}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Getting location…" : "Check in"}
      </button>
    </form>
  );
}

function VisitRow({
  visit,
  canCheckOut,
  onCheckedOut,
}: {
  visit: VisitDto;
  canCheckOut: boolean;
  onCheckedOut: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCheckOut() {
    setError(null);
    setSubmitting(true);
    try {
      const coords = await getCurrentCoordinates();
      await apiFetch(`/visits/${visit.id}/check-out`, {
        method: "PATCH",
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      });
      onCheckedOut();
    } catch (err) {
      if (err instanceof GeolocationError) {
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to check out");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const target = visit.lead ?? visit.customer;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{visit.purpose}</p>
          <p className="text-xs text-zinc-500">
            {visit.user.name}
            {target && (
              <>
                {" · "}
                {visit.leadId ? (
                  <Link href={`/leads/${visit.leadId}`} className="hover:underline">
                    {target.name}
                  </Link>
                ) : (
                  target.name
                )}
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Checked in{" "}
            <a
              href={mapsLink(visit.checkInLat, visit.checkInLng)}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {new Date(visit.checkInAt).toLocaleString()}
            </a>
            {visit.checkOutAt ? (
              <>
                {" · Checked out "}
                <a
                  href={mapsLink(visit.checkOutLat ?? "0", visit.checkOutLng ?? "0")}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {new Date(visit.checkOutAt).toLocaleString()}
                </a>
                {` (${formatDuration(visit.checkInAt, visit.checkOutAt)})`}
              </>
            ) : (
              " · In progress"
            )}
          </p>
          {visit.notes && <p className="mt-1 text-xs text-zinc-500">{visit.notes}</p>}
          {visit.checkOutNotes && (
            <p className="mt-1 text-xs text-zinc-500">Check-out notes: {visit.checkOutNotes}</p>
          )}
        </div>
        {canCheckOut && (
          <button
            onClick={onCheckOut}
            disabled={submitting}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Getting location…" : "Check out"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
