"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OWNER: "Owner",
  SALES_MANAGER: "Sales Manager",
  SALES_EXECUTIVE: "Sales Executive",
  FIELD_SALES_EXECUTIVE: "Field Sales Executive",
};

export function AppShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const { user, organization, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !organization) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="w-full xl:pl-[270px]">
        <AppHeader />
        <div className={`mx-auto px-4 py-6 sm:px-6 ${fullWidth ? "max-w-full" : "max-w-7xl"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export { ROLE_LABELS };
