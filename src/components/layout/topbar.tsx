"use client";

import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProfileMenu } from "@/components/layout/profile-menu";

const titleMap: Record<string, { section: string; page: string }> = {
  "/dashboard": { section: "TericVoice", page: "Dashboard" },
  "/entries": { section: "TericVoice", page: "Entries" },
  "/form-builder": { section: "TericVoice", page: "Form Builder" },
  "/settings": { section: "TericVoice", page: "Settings" },
};

export function Topbar() {
  const pathname = usePathname() ?? "/dashboard";
  const base = "/" + (pathname.split("/").filter(Boolean)[0] ?? "dashboard");
  const info = titleMap[base] ?? { section: "TericVoice", page: "Entry" };

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 px-6">
      <div className="flex items-center gap-1.5 text-[15px]">
        <span className="text-muted-foreground">{info.section}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-semibold text-foreground">{info.page}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entries, forms…"
            className="h-9 w-64 rounded-full border-none bg-muted pl-9 shadow-none focus-visible:ring-2"
          />
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="size-[17px]" strokeWidth={2} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-lime" />
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}
