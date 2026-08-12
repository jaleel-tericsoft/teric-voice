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
import { performLogout } from "@/lib/logout";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/entries", label: "Entries", icon: Inbox },
  { href: "/form-builder", label: "Form Builder", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Icon-only rail rather than the old labeled 264px sidebar — a small,
// glanceable footprint suits a glasses/wearable display far better than a
// text-heavy nav column. Every icon still carries its label via a tooltip
// so nothing's lost, just not permanently on-screen.
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await performLogout();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center rounded-3xl bg-sidebar px-2 py-5 text-sidebar-foreground">
      {/* Brand */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mb-6 flex size-8 items-center justify-center rounded-xl bg-teal text-teal-foreground">
            <Mic className="size-4" strokeWidth={2.5} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">TericVoice</TooltipContent>
      </Tooltip>

      {/* Primary navigation */}
      <nav className="flex flex-col gap-1">
        {primaryNav.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "relative flex size-11 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-lime" />
                  )}
                  <Icon className="size-[19px]" strokeWidth={2} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Account footer — profile (with Profile/Change Password in its
       * dropdown), notifications, and logout. Stacked, not side-by-side —
       * there's no spare width for a row at this rail size. */}
      <div className="mt-auto flex flex-col items-center gap-1 border-t border-sidebar-foreground/10 pt-4">
        <ProfileMenu compact />
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
          <TooltipContent side="right">Notifications</TooltipContent>
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
          <TooltipContent side="right">Logout</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
