"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { QuotationDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES } from "@/lib/badges";

const STATUS_OPTIONS = Object.keys(QUOTATION_STATUS_LABELS);

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const data = await apiFetch<QuotationDto[]>(`/quotations${query ? `?${query}` : ""}`);
      setQuotations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quotations");
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter change -> refetch
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Quotations</h2>
          <Link
            href="/quotations/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New quotation
          </Link>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {QUOTATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {quotations?.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {q.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {q.lead?.name ?? q.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    ₹{Number(q.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${QUOTATION_STATUS_STYLES[q.status]}`}
                    >
                      {QUOTATION_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {quotations && quotations.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No quotations yet.</p>
          )}
          {!quotations && !error && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">Loading quotations…</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
