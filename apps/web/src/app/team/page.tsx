"use client";

import { useEffect, useState } from "react";
import type { TwoFactorSetupDto, UserDto } from "@ai-salesos/shared";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppShell, ROLE_LABELS } from "@/components/AppShell";

export default function TeamPage() {
  const { user } = useAuth();
  const canManageUsers = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {canManageUsers && <TwoFactorSection />}
        <TeamSection canManageUsers={canManageUsers} />
      </div>
    </AppShell>
  );
}

/** Self-service TOTP 2FA enrollment for the signed-in OWNER/ADMIN (PRD §22). There is no
 * admin-managed toggle for other members' 2FA — each admin enrolls their own. */
function TwoFactorSection() {
  const { user, refresh } = useAuth();
  const [setupData, setSetupData] = useState<TwoFactorSetupDto | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onStartSetup() {
    setError(null);
    try {
      const data = await apiFetch<TwoFactorSetupDto>("/auth/2fa/setup", { method: "POST" });
      setSetupData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start 2FA setup");
    }
  }

  async function onEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
      setSetupData(null);
      setCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode }),
      });
      setShowDisable(false);
      setDisableCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Two-factor authentication
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Adds an authenticator-app code to your own sign-in. Optional for OWNER/ADMIN.
        </p>
      </div>

      <div className="px-5 py-4">
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {user?.twoFactorEnabled ? (
          showDisable ? (
            <form onSubmit={onDisable} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Enter a code to confirm</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {submitting ? "Disabling…" : "Confirm disable"}
              </button>
              <button
                type="button"
                onClick={() => setShowDisable(false)}
                className="text-sm text-zinc-500 hover:underline"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  Enabled
                </span>
                Two-factor authentication is protecting your account.
              </p>
              <button
                onClick={() => setShowDisable(true)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Disable
              </button>
            </div>
          )
        ) : setupData ? (
          <form onSubmit={onEnable} className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not a static asset */}
            <img
              src={setupData.qrCodeDataUrl}
              alt="Scan this QR code with your authenticator app"
              className="h-40 w-40 flex-shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800"
            />
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Scan with Google Authenticator, Authy, or similar, then enter the 6-digit code to
                confirm. Can&apos;t scan?{" "}
                <span className="break-all font-mono text-xs">{setupData.secret}</span>
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Code</span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {submitting ? "Confirming…" : "Confirm & enable"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupData(null);
                    setCode("");
                  }}
                  className="text-sm text-zinc-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Not enabled.</p>
            <button
              onClick={onStartSetup}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Enable 2FA
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function TeamSection({ canManageUsers }: { canManageUsers: boolean }) {
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<UserDto[]>("/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load team");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial team fetch on mount
    void load();
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Team</h2>
        {canManageUsers && (
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {showInvite ? "Cancel" : "Invite teammate"}
          </button>
        )}
      </div>

      {showInvite && (
        <InviteForm
          onInvited={() => {
            setShowInvite(false);
            void load();
          }}
        />
      )}

      {error && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!users && !error && (
        <p className="px-5 py-4 text-sm text-zinc-500">Loading team…</p>
      )}

      {users && (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                {!u.isActive && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-red-700 dark:bg-red-950 dark:text-red-400">
                    Inactive
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "FIELD_SALES_EXECUTIVE", label: "Field Sales Executive" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "ADMIN", label: "Admin" },
];

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES_EXECUTIVE");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({ name, email, role, password }),
      });
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite teammate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="password"
          placeholder="Temporary password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Inviting…" : "Send invite"}
      </button>
    </form>
  );
}
