"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PipelineBoardStageDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { TEMPERATURE_STYLES } from "@/lib/badges";

export default function PipelinePage() {
  const { user } = useAuth();
  const [stages, setStages] = useState<PipelineBoardStageDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  const canManageStages =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "SALES_MANAGER";

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<PipelineBoardStageDto[]>("/pipeline-stages/board");
      setStages(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load pipeline");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial board fetch
    void load();
  }, [load]);

  async function onDrop(stageId: string) {
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    if (!leadId || !stages) return;

    const current = stages.find((s) => s.leads.some((l) => l.id === leadId));
    if (current?.id === stageId) return;

    try {
      await apiFetch(`/leads/${leadId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ pipelineStageId: stageId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move lead");
    }
  }

  async function onAddStage(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    try {
      await apiFetch("/pipeline-stages", {
        method: "POST",
        body: JSON.stringify({ name: newStageName }),
      });
      setNewStageName("");
      setShowAddStage(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add stage");
    }
  }

  async function onDeleteStage(stageId: string) {
    if (!confirm("Delete this stage? It must be empty.")) return;
    try {
      await apiFetch(`/pipeline-stages/${stageId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete stage");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pipeline</h2>
          {canManageStages && (
            <button
              onClick={() => setShowAddStage((v) => !v)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {showAddStage ? "Cancel" : "Add stage"}
            </button>
          )}
        </div>

        {showAddStage && (
          <form onSubmit={onAddStage} className="flex gap-2">
            <input
              autoFocus
              placeholder="Stage name"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!stages && !error && <p className="text-sm text-zinc-500">Loading pipeline…</p>}

        {stages && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void onDrop(stage.id)}
                className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {stage.name}
                    </h3>
                    <span className="text-xs text-zinc-500">{stage.leads.length}</span>
                  </div>
                  {canManageStages && (
                    <button
                      onClick={() => void onDeleteStage(stage.id)}
                      title="Delete stage"
                      className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-2">
                  {stage.leads.map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      draggable
                      onDragStart={() => setDraggingLeadId(lead.id)}
                      className="cursor-grab rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm shadow-sm hover:border-zinc-300 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{lead.name}</p>
                      {lead.companyName && (
                        <p className="text-xs text-zinc-500">{lead.companyName}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TEMPERATURE_STYLES[lead.temperature]}`}
                        >
                          {lead.temperature}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {lead.assignedTo?.name ?? "Unassigned"}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {stage.leads.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-zinc-400">Drop leads here</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
