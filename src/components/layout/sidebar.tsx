"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Inbox,
  ClipboardList,
  Settings,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/entries", label: "Entries", icon: Inbox },
  { href: "/form-builder", label: "Form Builder", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col rounded-3xl bg-sidebar px-4 py-5 text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex size-8 items-center justify-center rounded-xl bg-lime text-lime-foreground">
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

      <div className="mt-auto pt-6">
        <Link
          href="/voice/new?form=vehicle-service-upsell"
          className="flex items-center justify-center gap-2 rounded-full bg-teal px-4 py-3 text-[14px] font-semibold text-teal-foreground transition-transform hover:bg-[#18464d] active:scale-[0.98]"
        >
          <Mic className="size-4" strokeWidth={2.5} />
          Start Voice Form
        </Link>
      </div>
    </aside>
  );
}
