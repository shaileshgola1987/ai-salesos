"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Kanban,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageSquare,
  Package,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Inbox", href: "/inbox", icon: MessageSquare },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Quotations", href: "/quotations", icon: FileText },
  { name: "Products", href: "/products", icon: Package },
  { name: "Visits", href: "/visits", icon: MapPin },
  { name: "Tasks", href: "/tasks", icon: ListChecks },
  { name: "Team", href: "/team", icon: UserCog },
];

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname?.startsWith(href) ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            AI
          </span>
          <span className="text-base font-semibold text-sidebar-foreground">AI SalesOS</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <p className="mb-2 px-2 text-xs font-bold uppercase leading-[21px] text-sidebar-foreground/60">
          Menu
        </p>
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-lightprimary hover:text-primary",
                    active && "bg-lightprimary text-primary",
                  )}
                >
                  <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[270px] border-r border-sidebar-border bg-sidebar xl:block">
      <SidebarInner />
    </aside>
  );
}

export { SidebarInner };
