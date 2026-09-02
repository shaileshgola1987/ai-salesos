"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  ConversationDto,
  FollowUpSuggestionDto,
  LeadDto,
  LeadScoreResultDto,
  PipelineStageDto,
  TaskDto,
  UserDto,
} from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/badges";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);
const TEMPERATURE_OPTIONS = ["HOT", "WARM", "COLD"];
const SOURCE_OPTIONS = Object.keys(SOURCE_LABELS);

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<LeadDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [stages, setStages] = useState<PipelineStageDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreSuggestion, setScoreSuggestion] = useState<{
    suggestedTemperature: string;
    reasoning: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [leadData, usersData, stagesData] = await Promise.all([
        apiFetch<LeadDto>(`/leads/${params.id}`),
        apiFetch<UserDto[]>("/users"),
        apiFetch<PipelineStageDto[]>("/pipeline-stages"),
      ]);
      setLead(leadData);
      setUsers(usersData);
      setStages(stagesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load lead");
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial lead fetch
    void load();
  }, [load]);

  async function updateField(field: string, value: string) {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<LeadDto>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      setLead(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update lead");
    } finally {
      setSaving(false);
    }
  }

  async function updateAssignment(assignedToId: string) {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<LeadDto>(`/leads/${lead.id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      setLead(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reassign lead");
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(pipelineStageId: string) {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<LeadDto>(`/leads/${lead.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ pipelineStageId }),
      });
      setLead(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move lead");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!lead) return;
    if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await apiFetch(`/leads/${lead.id}`, { method: "DELETE" });
      router.replace("/leads");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete lead");
      setSaving(false);
    }
  }

  const canDelete = user?.role === "OWNER" || user?.role === "ADMIN";

  async function onRecalculateScore() {
    if (!lead) return;
    setScoring(true);
    setError(null);
    try {
      const result = await apiFetch<LeadScoreResultDto>(`/leads/${lead.id}/ai/score`, {
        method: "POST",
      });
      setLead(result.lead);
      setScoreSuggestion({
        suggestedTemperature: result.suggestedTemperature,
        reasoning: result.reasoning,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to recalculate score");
    } finally {
      setScoring(false);
    }
  }

  async function onApplySuggestedTemperature() {
    if (!scoreSuggestion) return;
    await updateField("temperature", scoreSuggestion.suggestedTemperature);
    setScoreSuggestion(null);
  }

  async function onMessage() {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const conversation = await apiFetch<ConversationDto>("/conversations", {
        method: "POST",
        body: JSON.stringify({ phone: lead.phone, leadId: lead.id }),
      });
      router.push(`/inbox?conversationId=${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open WhatsApp conversation");
      setSaving(false);
    }
  }

  return (
    <AppShell>
      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!lead && !error && <p className="text-sm text-zinc-500">Loading lead…</p>}

      {lead && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {lead.name}
              </h2>
              {lead.companyName && <p className="text-sm text-zinc-500">{lead.companyName}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/quotations/new?leadId=${lead.id}`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Create quotation
              </Link>
              <button
                onClick={onMessage}
                disabled={saving}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Message on WhatsApp
              </button>
              {canDelete && (
                <button
                  onClick={onDelete}
                  disabled={saving}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
            <Field label="Phone">
              <input
                defaultValue={lead.phone}
                onBlur={(e) => e.target.value !== lead.phone && updateField("phone", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                defaultValue={lead.email ?? ""}
                onBlur={(e) => e.target.value !== (lead.email ?? "") && updateField("email", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={lead.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temperature">
              <select
                value={lead.temperature}
                onChange={(e) => updateField("temperature", e.target.value)}
                className={inputClass}
              >
                {TEMPERATURE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                value={lead.source}
                onChange={(e) => updateField("source", e.target.value)}
                className={inputClass}
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pipeline stage">
              <select
                value={lead.pipelineStageId ?? ""}
                onChange={(e) => updateStage(e.target.value)}
                className={inputClass}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assigned to">
              <select
                value={lead.assignedToId ?? ""}
                onChange={(e) => updateAssignment(e.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="AI score">
              <div className="flex flex-col gap-1 px-1 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-500">{lead.score} / 100</p>
                  <button
                    type="button"
                    onClick={onRecalculateScore}
                    disabled={scoring}
                    className="text-xs text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    {scoring ? "Scoring…" : "Recalculate"}
                  </button>
                </div>
                {scoreSuggestion && (
                  <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    <p>{scoreSuggestion.reasoning}</p>
                    {scoreSuggestion.suggestedTemperature !== lead.temperature && (
                      <button
                        type="button"
                        onClick={onApplySuggestedTemperature}
                        className="mt-1 font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        Apply suggested temperature: {scoreSuggestion.suggestedTemperature}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </div>

          <AiSummarySection lead={lead} onUpdated={setLead} />

          <FollowUpsSection leadId={lead.id} users={users} currentUserId={user?.id} />
        </div>
      )}
    </AppShell>
  );
}

function AiSummarySection({
  lead,
  onUpdated,
}: {
  lead: LeadDto;
  onUpdated: (lead: LeadDto) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const updated = await apiFetch<LeadDto>(`/leads/${lead.id}/ai/summary`, { method: "POST" });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">AI summary</h3>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {generating ? "Generating…" : lead.aiSummary ? "Regenerate" : "Generate summary"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {lead.aiSummary ? (
        <>
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{lead.aiSummary}</p>
          {lead.aiSummaryGeneratedAt && (
            <p className="mt-2 text-xs text-zinc-400">
              Generated {new Date(lead.aiSummaryGeneratedAt).toLocaleString()}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">No summary yet.</p>
      )}
    </section>
  );
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FollowUpsSection({
  leadId,
  users,
  currentUserId,
}: {
  leadId: string;
  users: UserDto[];
  currentUserId?: string;
}) {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedToId, setAssignedToId] = useState(currentUserId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionReasoning, setSuggestionReasoning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<TaskDto[]>(`/tasks?leadId=${leadId}`);
      setTasks(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load follow-ups");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial follow-ups fetch
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          dueAt: new Date(dueAt).toISOString(),
          leadId,
          assignedToId: assignedToId || undefined,
        }),
      });
      setTitle("");
      setDueAt("");
      setSuggestionReasoning(null);
      setShowCreate(false);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create follow-up");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSuggestFollowUp() {
    setSuggesting(true);
    setError(null);
    try {
      const suggestion = await apiFetch<FollowUpSuggestionDto>(
        `/leads/${leadId}/ai/follow-up-suggestion`,
        { method: "POST" },
      );
      setTitle(suggestion.title);
      setDueAt(toDatetimeLocalValue(suggestion.suggestedDueAt));
      setSuggestionReasoning(suggestion.reasoning);
      setShowCreate(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to suggest a follow-up");
    } finally {
      setSuggesting(false);
    }
  }

  async function toggle(task: TaskDto) {
    try {
      await apiFetch(`/tasks/${task.id}/${task.status === "COMPLETED" ? "reopen" : "complete"}`, {
        method: "PATCH",
      });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update follow-up");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Follow-ups</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onSuggestFollowUp}
            disabled={suggesting}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {suggesting ? "Thinking…" : "Suggest follow-up"}
          </button>
          <button
            onClick={() => {
              setSuggestionReasoning(null);
              setShowCreate((v) => !v);
            }}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showCreate ? "Cancel" : "Add follow-up"}
          </button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={onCreate}
          className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {suggestionReasoning && (
            <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              AI suggestion: {suggestionReasoning}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="What needs to happen?"
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
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {error && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tasks && tasks.length === 0 && (
        <p className="px-5 py-4 text-sm text-zinc-500">No follow-ups yet.</p>
      )}

      {tasks && tasks.length > 0 && (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {tasks.map((task) => {
            const overdue = task.status === "PENDING" && new Date(task.dueAt) < new Date();
            return (
              <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={task.status === "COMPLETED"}
                  onChange={() => toggle(task)}
                  className="h-4 w-4"
                />
                <div>
                  <p
                    className={`text-sm ${
                      task.status === "COMPLETED"
                        ? "text-zinc-400 line-through"
                        : "text-zinc-900 dark:text-zinc-50"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className={`text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
                    Due {new Date(task.dueAt).toLocaleString()} · {task.assignedTo.name}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
