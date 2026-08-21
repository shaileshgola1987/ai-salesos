"use client";

import { useEffect, useState } from "react";
import type { MessageTemplateDto } from "@ai-salesos/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplateDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canManage =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "SALES_MANAGER";

  async function load() {
    try {
      const data = await apiFetch<MessageTemplateDto[]>("/message-templates");
      setTemplates(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load templates");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial templates fetch
    void load();
  }, []);

  async function onDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await apiFetch(`/message-templates/${id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete template");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Message templates
          </h2>
          {canManage && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {showCreate ? "Cancel" : "New template"}
            </button>
          )}
        </div>

        {showCreate && (
          <CreateTemplateForm
            onCreated={() => {
              setShowCreate(false);
              void load();
            }}
          />
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-2">
          {templates?.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.name}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.body}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {templates && templates.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
              No templates yet.
            </p>
          )}
          {!templates && !error && <p className="text-sm text-zinc-500">Loading…</p>}
        </div>
      </div>
    </AppShell>
  );
}

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/message-templates", {
        method: "POST",
        body: JSON.stringify({ name, body }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input
        placeholder="Template name (e.g. Greeting)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <textarea
        placeholder="Message body"
        required
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Creating…" : "Create template"}
      </button>
    </form>
  );
}
