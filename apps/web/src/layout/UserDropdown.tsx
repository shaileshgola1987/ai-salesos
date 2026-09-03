"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OWNER: "Owner",
  SALES_MANAGER: "Sales Manager",
  SALES_EXECUTIVE: "Sales Executive",
  FIELD_SALES_EXECUTIVE: "Field Sales Executive",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function UserDropdown() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full focus-visible:outline-none">
          <Avatar>
            <AvatarFallback className="bg-primary text-sm font-semibold text-white">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-foreground">{user.name}</span>
            <span className="block text-xs text-muted-foreground">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="gap-2 text-sm text-foreground hover:bg-lightprimary hover:text-primary"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
