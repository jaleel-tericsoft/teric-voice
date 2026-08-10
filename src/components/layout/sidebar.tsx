"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Inbox,
  ClipboardList,
  Settings,
  Mic,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/entries", label: "Entries", icon: Inbox },
  { href: "/form-builder", label: "Form Builder", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    // Clears the session cookie server-side — just navigating to /login
    // without this would leave the cookie valid, so middleware would let
    // you straight back in without re-entering the password.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col rounded-3xl bg-sidebar px-4 py-5 text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex size-8 items-center justify-center rounded-xl bg-teal text-teal-foreground">
          <Mic className="size-4" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold tracking-tight">TericVoice</span>
      </div>

      {/* Primary navigation */}
      <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/40">
        Workspace
      </div>
      <nav className="flex flex-col gap-0.5">
        {primaryNav.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-lime" />
              )}
              <Icon className="size-[17px]" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Account footer — profile (with Profile/Change Password in its
       * dropdown), notifications, and logout, now that there's no topbar
       * to host them. */}
      <div className="mt-auto flex items-center gap-1 border-t border-sidebar-foreground/10 pt-4">
        <ProfileMenu />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex size-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Bell className="size-[17px]" strokeWidth={2} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Notifications</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-[17px]" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Logout</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
