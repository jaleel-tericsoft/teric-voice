"use client";

import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProfileMenu } from "@/components/layout/profile-menu";

export function Topbar() {
  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 px-6">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search entries, forms…"
          className="h-9 w-full rounded-full border-none bg-muted pl-9 shadow-none focus-visible:ring-2"
        />
      </div>

      <div className="flex items-center gap-3">
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
