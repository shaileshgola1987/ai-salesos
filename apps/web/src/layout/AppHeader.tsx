"use client";

import { useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { SidebarInner } from "./AppSidebar";
import UserDropdown from "./UserDropdown";

export default function AppHeader() {
  const { organization } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-foreground hover:bg-lightprimary hover:text-primary xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {organization?.name ?? "AI SalesOS"}
              </p>
              {organization && (
                <p className="truncate text-xs text-muted-foreground">
                  {organization.plan.replace("_", " ")} plan
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-lightprimary hover:text-primary"
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="hidden h-5 w-5 dark:block" />
            </button>
            <UserDropdown />
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-dark/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[270px] bg-sidebar shadow-lg">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-full text-sidebar-foreground hover:bg-lightprimary hover:text-primary"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarInner onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
