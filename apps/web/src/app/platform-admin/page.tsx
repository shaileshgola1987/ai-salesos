"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AiProviderName, type AiSettingsDto } from "@ai-salesos/shared";
import { ApiError } from "@/lib/api";
import { clearPlatformToken, getPlatformToken, platformApiFetch } from "@/lib/platform-api";

const PROVIDERS = [AiProviderName.ANTHROPIC, AiProviderName.OPENAI, AiProviderName.GEMINI];

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  [AiProviderName.ANTHROPIC]: "Anthropic (Claude)",
  [AiProviderName.OPENAI]: "OpenAI",
  [AiProviderName.GEMINI]: "Google Gemini",
};

export default function PlatformAdminPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AiSettingsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingActive, setSavingActive] = useState(false);

  const load = useCallback(async () => {
    if (!getPlatformToken()) {
      router.replace("/platform-admin/login");
      return;
    }
    try {
      const data = await platformApiFetch<AiSettingsDto>("/platform/ai-settings");
      setSettings(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearPlatformToken();
        router.replace("/platform-admin/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load AI settings");
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial settings fetch
    void load();
  }, [load]);

  function onLogout() {
    clearPlatformToken();
    router.replace("/platform-admin/login");
  }

  async function onSetActive(provider: AiProviderName | null) {
    setSavingActive(true);
    setError(null);
    try {
      const updated = await platformApiFetch<AiSettingsDto>("/platform/ai-settings/active", {
        method: "PATCH",
        body: JSON.stringify({ provider }),
      });
      setSettings(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update the active provider");
    } finally {
      setSavingActive(false);
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Platform Admin — AI Settings
            </h1>
            <p className="text-xs text-zinc-500">
              Cross-tenant. No Organization Owner/Admin can see or reach this page.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!settings && !error && <p className="text-sm text-zinc-500">Loading…</p>}

        {settings && (
          <>
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Active AI provider
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Every organization&apos;s AI Lead Scoring, summaries, follow-up and reply
                suggestions run on this provider. Configure a key below before activating it.
              </p>
              <select
                value={settings.activeProvider ?? ""}
                onChange={(e) => onSetActive((e.target.value as AiProviderName) || null)}
                disabled={savingActive}
                className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">None (rule-based stub, no API key)</option>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                    {settings.providers.some((c) => c.provider === p) ? "" : " (not configured yet)"}
                  </option>
                ))}
              </select>
            </section>

            <div className="flex flex-col gap-4">
              {PROVIDERS.map((provider) => (
                <ProviderCard
                  key={provider}
                  provider={provider}
                  config={settings.providers.find((c) => c.provider === provider) ?? null}
                  isActive={settings.activeProvider === provider}
                  onSaved={setSettings}
                  onRemoved={setSettings}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProviderCard({
  provider,
  config,
  isActive,
  onSaved,
  onRemoved,
}: {
  provider: AiProviderName;
  config: AiSettingsDto["providers"][number] | null;
  isActive: boolean;
  onSaved: (settings: AiSettingsDto) => void;
  onRemoved: (settings: AiSettingsDto) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(config?.model ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await platformApiFetch<AiSettingsDto>(`/platform/ai-settings/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ apiKey, model: model || undefined }),
      });
      setApiKey("");
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the API key");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!confirm(`Remove the stored ${PROVIDER_LABELS[provider]} API key?`)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await platformApiFetch<AiSettingsDto>(`/platform/ai-settings/${provider}`, {
        method: "DELETE",
      });
      onRemoved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove the API key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {PROVIDER_LABELS[provider]}
        </h3>
        {isActive && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Active
          </span>
        )}
      </div>

      {config ? (
        <p className="mt-2 text-xs text-zinc-500">
          Key on file: <span className="font-mono">{config.keyPreview}</span>
          {config.model && <> · Model: {config.model}</>} · Updated{" "}
          {new Date(config.updatedAt).toLocaleString()}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">No API key configured yet.</p>
      )}

      <form onSubmit={onSave} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">
            {config ? "Replace API key" : "API key"}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config ? "•••••••••••• (leave blank to keep unchanged... — enter to replace)" : "sk-…"}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">Model (optional)</span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="default"
            className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Save
        </button>
        {config && (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
          >
            Remove
          </button>
        )}
      </form>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
