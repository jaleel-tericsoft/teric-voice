"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProfileMenu } from "@/components/layout/profile-menu";

export function Topbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  // Keep the box in sync if the query changes from elsewhere (e.g. clearing
  // it on the entries page) — adjusted during render rather than an effect,
  // per React's guidance for state derived from a changing prop.
  const [trackedUrlQuery, setTrackedUrlQuery] = useState(urlQuery);
  if (urlQuery !== trackedUrlQuery) {
    setTrackedUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  function runSearch() {
    const trimmed = query.trim();
    const params = new URLSearchParams();
    const form = searchParams.get("form");
    if (form) params.set("form", form);
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    router.push(qs ? `/entries?${qs}` : "/entries");
  }

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 px-6">
      <div className="relative w-full max-w-xs">
        <button
          type="button"
          aria-label="Search"
          onClick={runSearch}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <Search className="size-4" />
        </button>
        {/* Plain text search — no autocomplete/dropdown, results only show
         * up on the Entries page after Enter (or navigating away). */}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
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
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal" />
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}
