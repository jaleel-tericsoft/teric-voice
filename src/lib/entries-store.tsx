"use client";

// A session-only, in-memory store for entries — mirrors forms-store.tsx.
// This is what makes "Save Draft & Exit" and resuming a voice session real:
// a draft entry lives here the moment it's saved, shows up in Entries
// immediately, and can be reopened to continue where it left off. Like
// forms, there's no backend yet, so this doesn't survive a page reload.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { entries as seedEntries, computeDashboardStats } from "@/lib/mock-data";
import type { DashboardStats, Entry } from "@/types";

interface EntriesStore {
  entries: Entry[];
  stats: DashboardStats;
  getEntryById: (id: string) => Entry | undefined;
  getEntriesForForm: (formId: string) => Entry[];
  /** Inserts a new entry, or replaces one with a matching id — the single
   * write path for both "Save Draft & Exit" (status in_progress) and
   * submitting the form (status submitted). */
  upsertEntry: (entry: Entry) => void;
}

const EntriesContext = createContext<EntriesStore | null>(null);

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>(seedEntries);

  const value = useMemo<EntriesStore>(
    () => ({
      entries,
      stats: computeDashboardStats(entries),
      getEntryById: (id) => entries.find((e) => e.id === id),
      getEntriesForForm: (formId) => entries.filter((e) => e.formId === formId),
      upsertEntry: (entry) =>
        setEntries((prev) => {
          const idx = prev.findIndex((e) => e.id === entry.id);
          if (idx === -1) return [...prev, entry];
          const next = [...prev];
          next[idx] = entry;
          return next;
        }),
    }),
    [entries]
  );

  return <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>;
}

export function useEntriesStore(): EntriesStore {
  const ctx = useContext(EntriesContext);
  if (!ctx) throw new Error("useEntriesStore must be used within <EntriesProvider>");
  return ctx;
}
