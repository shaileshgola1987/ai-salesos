"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LeadDto, PipelineStageDto, UserDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { STATUS_LABELS, TEMPERATURE_STYLES } from "@/lib/badges";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);
const TEMPERATURE_OPTIONS = ["HOT", "WARM", "COLD"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadDto[] | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [stages, setStages] = useState<PipelineStageDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (temperatureFilter) params.set("temperature", temperatureFilter);
      if (assignedFilter) params.set("assignedToId", assignedFilter);
      if (search) params.set("search", search);
      const query = params.toString();
      const data = await apiFetch<LeadDto[]>(`/leads${query ? `?${query}` : ""}`);
      setLeads(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load leads");
    }
  }, [statusFilter, temperatureFilter, assignedFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filters change -> refetch
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    void Promise.all([
      apiFetch<UserDto[]>("/users").then(setUsers),
      apiFetch<PipelineStageDto[]>("/pipeline-stages").then(setStages),
    ]).catch(() => undefined);
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Leads</h2>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showCreate ? "Cancel" : "New lead"}
          </button>
        </div>

        {showCreate && (
          <CreateLeadForm
            users={users}
            stages={stages}
            onCreated={() => {
              setShowCreate(false);
              void loadLeads();
            }}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Search name, company, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={temperatureFilter}
            onChange={(e) => setTemperatureFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All temperatures</option>
            {TEMPERATURE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Anyone assigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Temp</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {leads?.map((lead) => (
                <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {lead.name}
                    </Link>
                    {lead.companyName && (
                      <p className="text-xs text-zinc-500">{lead.companyName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{lead.phone}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {STATUS_LABELS[lead.status] ?? lead.status}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${TEMPERATURE_STYLES[lead.temperature]}`}
                    >
                      {lead.temperature}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {lead.pipelineStage?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {lead.assignedTo?.name ?? "Unassigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads && leads.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No leads yet.</p>
          )}
          {!leads && !error && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Loading leads…</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CreateLeadForm({
  users,
  stages,
  onCreated,
}: {
  users: UserDto[];
  stages: PipelineStageDto[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    source: "MANUAL",
    temperature: "COLD",
    assignedToId: "",
    pipelineStageId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/leads", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName || undefined,
          phone: form.phone,
          email: form.email || undefined,
          source: form.source,
          temperature: form.temperature,
          assignedToId: form.assignedToId || undefined,
          pipelineStageId: form.pipelineStageId || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="Company (optional)"
          value={form.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="Phone"
          required
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="Email (optional)"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={form.source}
          onChange={(e) => update("source", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {Object.keys({
            WHATSAPP: 0,
            WEBSITE_FORM: 0,
            INDIAMART: 0,
            JUSTDIAL: 0,
            META_ADS: 0,
            GOOGLE_ADS: 0,
            REFERRAL: 0,
            MANUAL: 0,
            IMPORT: 0,
          }).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={form.temperature}
          onChange={(e) => update("temperature", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {TEMPERATURE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={form.assignedToId}
          onChange={(e) => update("assignedToId", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={form.pipelineStageId}
          onChange={(e) => update("pipelineStageId", e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Default stage</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Creating…" : "Create lead"}
      </button>
    </form>
  );
}
