"use client";

import { useEffect, useState } from "react";
import type { DashboardOverviewDto, SalespersonPerformanceDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell, ROLE_LABELS } from "@/components/AppShell";
import { STATUS_LABELS } from "@/lib/badges";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [performance, setPerformance] = useState<SalespersonPerformanceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<DashboardOverviewDto>("/dashboard/overview").then(setOverview),
      apiFetch<SalespersonPerformanceDto[]>("/dashboard/performance").then(setPerformance),
    ]).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    });
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h2>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {overview && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total leads" value={overview.totalLeads} />
            <StatCard label="Customers" value={overview.totalCustomers} />
            <StatCard label="Tasks pending" value={overview.tasksPending} />
            <StatCard
              label="Tasks overdue"
              value={overview.tasksOverdue}
              tone={overview.tasksOverdue > 0 ? "warn" : "default"}
            />
          </div>
        )}

        {overview && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BreakdownCard
              title="Leads by status"
              entries={Object.entries(overview.leadsByStatus)}
              labels={STATUS_LABELS}
            />
            <BreakdownCard
              title="Leads by temperature"
              entries={Object.entries(overview.leadsByTemperature)}
            />
          </div>
        )}

        {!overview && !error && <p className="text-sm text-zinc-500">Loading overview…</p>}

        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Salesperson performance
            </h3>
          </div>
          {performance && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">Salesperson</th>
                    <th className="px-5 py-3 font-medium">Leads assigned</th>
                    <th className="px-5 py-3 font-medium">Won</th>
                    <th className="px-5 py-3 font-medium">Lost</th>
                    <th className="px-5 py-3 font-medium">Tasks pending</th>
                    <th className="px-5 py-3 font-medium">Tasks overdue</th>
                    <th className="px-5 py-3 font-medium">Tasks completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {performance.map((row) => (
                    <tr key={row.user.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {row.user.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {ROLE_LABELS[row.user.role] ?? row.user.role}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.leadsAssigned}
                      </td>
                      <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400">
                        {row.leadsWon}
                      </td>
                      <td className="px-5 py-3 text-red-600 dark:text-red-400">
                        {row.leadsLost}
                      </td>
                      <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.tasksPending}
                      </td>
                      <td
                        className={
                          row.tasksOverdue > 0
                            ? "px-5 py-3 font-medium text-amber-600 dark:text-amber-400"
                            : "px-5 py-3 text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {row.tasksOverdue}
                      </td>
                      <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.tasksCompleted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {performance.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-zinc-500">No data yet.</p>
              )}
            </div>
          )}
          {!performance && !error && (
            <p className="px-5 py-4 text-sm text-zinc-500">Loading performance…</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "warn" && value > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BreakdownCard({
  title,
  entries,
  labels,
}: {
  title: string;
  entries: [string, number][];
  labels?: Record<string, string>;
}) {
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {entries.map(([key, count]) => (
          <li key={key} className="flex items-center gap-2 text-sm">
            <span className="w-28 flex-shrink-0 text-zinc-600 dark:text-zinc-400">
              {labels?.[key] ?? key}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-6 text-right text-zinc-500">{count}</span>
          </li>
        ))}
        {entries.length === 0 && <p className="text-sm text-zinc-500">No data yet.</p>}
      </ul>
    </div>
  );
}
