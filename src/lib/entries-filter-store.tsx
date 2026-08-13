"use client";

// Session-only, shared state for the Entries table's column filters —
// mirrors form-builder-draft-store.tsx: lifted out of entries-table.tsx
// (which used to hold `filters` as plain local state) into a context
// mounted at the (app) layout level, specifically so the ambient
// widget's voice tools can drive the exact same filters the table
// renders, rather than two copies that could drift apart.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getEntryTableColumns, findQuestion } from "@/lib/form-utils";
import type { FormDefinition } from "@/types";

export type FilterState = Record<string, Set<string>>;

// Same two synthetic filter dimensions entries-table.tsx already renders
// funnel icons for (status/email aren't real form questions, so they
// don't come from getEntryTableColumns) — this is now their one source
// of truth, imported by entries-table.tsx rather than redefined there.
export interface FilterOption {
  label: string;
  value: string;
}

export const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

export const EMAIL_FILTER_OPTIONS: FilterOption[] = [
  { label: "Sent", value: "sent" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Not sent", value: "not_sent" },
];

interface ActionResult {
  ok: boolean;
  message: string;
}

interface EntriesFilterStore {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  /** The Entries page calls this every render (with null on unmount) so
   * voice filtering always resolves against whichever form's entries are
   * actually on screen right now, and so filterByVoice can tell the
   * agent filtering isn't available at all when nobody's looking at the
   * table. */
  registerActiveForm: (form: FormDefinition | null) => void;
  resetFilters: () => ActionResult;
  filterByVoice: (field: string, value: string) => ActionResult;
}

const EntriesFilterContext = createContext<EntriesFilterStore | null>(null);

export function EntriesFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>({});
  const activeFormRef = useRef<FormDefinition | null>(null);

  const registerActiveForm = useCallback((form: FormDefinition | null) => {
    activeFormRef.current = form;
  }, []);

  const resetFilters = useCallback((): ActionResult => {
    setFilters({});
    return { ok: true, message: "Filters reset — showing every entry again." };
  }, []);

  // Matches a spoken (field, value) pair against whatever's actually
  // filterable on the currently-viewed form's table: the two synthetic
  // status/email dimensions, or any single_select question's options —
  // exactly the same set entries-table.tsx renders a funnel icon for, so
  // voice can never apply a filter the UI itself couldn't. `field` is a
  // best-effort hint (may be empty if the user didn't name one, e.g.
  // "show me the completed ones") — every candidate whose label loosely
  // matches (or wasn't specified) gets tried before giving up.
  const filterByVoice = useCallback((field: string, value: string): ActionResult => {
    const form = activeFormRef.current;
    if (!form) {
      return {
        ok: false,
        message:
          "Filtering only works while the Entries table is actually on screen — tell the user to head to Entries first, or offer to take them there.",
      };
    }
    const fieldNeedle = field.trim().toLowerCase();
    const valueNeedle = value.trim().toLowerCase();
    if (!valueNeedle) {
      return { ok: false, message: "What value should that filter match? Ask the user to clarify." };
    }

    const fieldMentions = (...keywords: string[]) =>
      !fieldNeedle || keywords.some((k) => fieldNeedle.includes(k) || k.includes(fieldNeedle));

    if (fieldMentions("status", "progress", "complete", "completed")) {
      const match = STATUS_FILTER_OPTIONS.find(
        (o) => o.label.toLowerCase().includes(valueNeedle) || valueNeedle.includes(o.label.toLowerCase())
      );
      if (match) {
        setFilters((prev) => ({ ...prev, status: new Set([match.value]) }));
        return { ok: true, message: `Filtered to ${match.label} entries.` };
      }
    }

    if (fieldMentions("email", "mail", "delivery")) {
      const match = EMAIL_FILTER_OPTIONS.find(
        (o) => o.label.toLowerCase().includes(valueNeedle) || valueNeedle.includes(o.label.toLowerCase())
      );
      if (match) {
        setFilters((prev) => ({ ...prev, email: new Set([match.value]) }));
        return { ok: true, message: `Filtered to entries with email ${match.label.toLowerCase()}.` };
      }
    }

    for (const col of getEntryTableColumns(form)) {
      const q = findQuestion(form, col.key);
      if (!q?.options) continue;
      if (fieldNeedle && !col.label.toLowerCase().includes(fieldNeedle)) continue;
      const optMatch = q.options.find(
        (o) => o.label.toLowerCase().includes(valueNeedle) || valueNeedle.includes(o.label.toLowerCase())
      );
      if (optMatch) {
        setFilters((prev) => ({ ...prev, [col.key]: new Set([optMatch.value]) }));
        return { ok: true, message: `Filtered ${col.label} to "${optMatch.label}".` };
      }
    }

    const filterableFields = [
      "status",
      "email delivery",
      ...getEntryTableColumns(form)
        .filter((col) => findQuestion(form, col.key)?.options)
        .map((col) => col.label),
    ].join(", ");
    return {
      ok: false,
      message: `That filter isn't available on this table — this form can only be filtered by ${filterableFields}. Tell the user plainly that filter isn't applicable here, and ask if they'd like a different one instead.`,
    };
  }, []);

  const value = useMemo<EntriesFilterStore>(
    () => ({ filters, setFilters, registerActiveForm, resetFilters, filterByVoice }),
    [filters, registerActiveForm, resetFilters, filterByVoice]
  );

  return <EntriesFilterContext.Provider value={value}>{children}</EntriesFilterContext.Provider>;
}

export function useEntriesFilterStore(): EntriesFilterStore {
  const ctx = useContext(EntriesFilterContext);
  if (!ctx) throw new Error("useEntriesFilterStore must be used within <EntriesFilterProvider>");
  return ctx;
}
