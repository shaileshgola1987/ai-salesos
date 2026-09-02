"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OWNER: "Owner",
  SALES_MANAGER: "Sales Manager",
  SALES_EXECUTIVE: "Sales Executive",
  FIELD_SALES_EXECUTIVE: "Field Sales Executive",
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/quotations", label: "Quotations" },
  { href: "/products", label: "Products" },
  { href: "/visits", label: "Visits" },
  { href: "/tasks", label: "Tasks" },
  { href: "/team", label: "Team" },
];

export function AppShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const { user, organization, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !organization) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {organization.name}
            </h1>
            <p className="text-xs text-zinc-500">
              {organization.plan.replace("_", " ")} plan · Signed in as {user.name} (
              {ROLE_LABELS[user.role] ?? user.role})
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 px-6">
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col ${
          fullWidth ? "max-w-7xl px-6 py-6" : "max-w-5xl px-6 py-8"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export { ROLE_LABELS };
