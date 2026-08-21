"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LeadDto, TaskDto, UserDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [assignedFilter, setAssignedFilter] = useState("");

  const isManager =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "SALES_MANAGER";

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (assignedFilter) params.set("assignedToId", assignedFilter);
      const query = params.toString();
      const data = await apiFetch<TaskDto[]>(`/tasks${query ? `?${query}` : ""}`);
      setTasks(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load tasks");
    }
  }, [statusFilter, assignedFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filters change -> refetch
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void Promise.all([
      apiFetch<UserDto[]>("/users").then(setUsers),
      apiFetch<LeadDto[]>("/leads").then(setLeads),
    ]).catch(() => undefined);
  }, []);

  async function onComplete(task: TaskDto) {
    try {
      await apiFetch(`/tasks/${task.id}/complete`, { method: "PATCH" });
      void loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete task");
    }
  }

  async function onReopen(task: TaskDto) {
    try {
      await apiFetch(`/tasks/${task.id}/reopen`, { method: "PATCH" });
      void loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reopen task");
    }
  }

  async function onDelete(task: TaskDto) {
    if (!confirm(`Delete follow-up "${task.title}"?`)) return;
    try {
      await apiFetch(`/tasks/${task.id}`, { method: "DELETE" });
      void loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete task");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Tasks &amp; Follow-ups
          </h2>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showCreate ? "Cancel" : "New follow-up"}
          </button>
        </div>

        {showCreate && (
          <CreateTaskForm
            users={users}
            leads={leads}
            defaultAssigneeId={user?.id}
            onCreated={() => {
              setShowCreate(false);
              void loadTasks();
            }}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="">All</option>
          </select>
          {isManager && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
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
          {tasks?.map((task) => {
            const overdue = task.status === "PENDING" && new Date(task.dueAt) < new Date();
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.status === "COMPLETED"}
                    onChange={() => (task.status === "COMPLETED" ? onReopen(task) : onComplete(task))}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        task.status === "COMPLETED"
                          ? "text-zinc-400 line-through"
                          : "text-zinc-900 dark:text-zinc-50"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.notes && <p className="text-xs text-zinc-500">{task.notes}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                        Due {new Date(task.dueAt).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span>{task.assignedTo.name}</span>
                      {task.lead && (
                        <>
                          <span>·</span>
                          <Link href={`/leads/${task.lead.id}`} className="hover:underline">
                            {task.lead.name}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(task)}
                  className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            );
          })}
          {tasks && tasks.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
              No follow-ups here.
            </p>
          )}
          {!tasks && !error && <p className="text-sm text-zinc-500">Loading tasks…</p>}
        </div>
      </div>
    </AppShell>
  );
}

function CreateTaskForm({
  users,
  leads,
  defaultAssigneeId,
  onCreated,
}: {
  users: UserDto[];
  leads: LeadDto[];
  defaultAssigneeId?: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [leadId, setLeadId] = useState("");
  const [assignedToId, setAssignedToId] = useState(defaultAssigneeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          notes: notes || undefined,
          dueAt: new Date(dueAt).toISOString(),
          leadId: leadId || undefined,
          assignedToId: assignedToId || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create follow-up");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="datetime-local"
          required
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">No linked lead</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Creating…" : "Create follow-up"}
      </button>
    </form>
  );
}
