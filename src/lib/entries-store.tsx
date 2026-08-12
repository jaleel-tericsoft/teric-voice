"use client";

// A session-only, in-memory store for entries — mirrors forms-store.tsx.
// This is what makes "Save Draft & Exit" and resuming a voice session real:
// a draft entry lives here the moment it's saved, shows up in Entries
// immediately, and can be reopened to continue where it left off. Like
// forms, there's no backend yet, so this doesn't survive a page reload.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { entries as seedEntries, computeDashboardStats, currentUser } from "@/lib/mock-data";
import type { DashboardStats, Entry, EntryAnswer } from "@/types";

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

// ---------------------------------------------------------------------------
// Email actions — real reads/writes against the entry, not the old
// setTimeout-only mock in resend-email-button.tsx. Each of these returns
// the *updated* entry rather than mutating in place; callers pass the
// result straight to upsertEntry (kept as plain functions, not store
// methods, so both the resend button and the ambient voice widget's
// resend_pdf_email/record_customer_email tools can share them without
// either needing to be inside a component that owns the store).
// ---------------------------------------------------------------------------

/** Looks up an entry the way a person would say it out loud — an entry ID
 * ("ENT-002") or a number plate ("YB19 FXP"), case- and space-insensitive
 * either way. Used by the ambient widget's resend_pdf_email/
 * record_customer_email tools, since a spoken identifier won't come back
 * pre-formatted the way entries-table's exact-id lookups expect. */
export function findEntryByIdentifier(entries: Entry[], identifier: string): Entry | undefined {
  const normalize = (s: string) => s.toUpperCase().replace(/\s+/g, "");
  const target = normalize(identifier);
  if (!target) return undefined;
  return entries.find((entry) => {
    if (normalize(entry.id) === target) return true;
    const plate = entry.answers.find((a) => a.fieldName === "number_plate");
    return typeof plate?.value === "string" && normalize(plate.value) === target;
  });
}

/** The email an entry would actually be sent to: whatever's already on
 * `entry.email.recipient` (set once a send has happened), falling back to
 * the form's own contact_email answer if one was captured but nothing's
 * been sent yet. Empty string if neither exists. */
export function resolveRecipientEmail(entry: Entry): string {
  if (entry.email.recipient) return entry.email.recipient;
  const answer = entry.answers.find((a) => a.fieldName === "contact_email");
  return typeof answer?.value === "string" ? answer.value : "";
}

/** Records (or corrects) the customer's email on the entry — both as a
 * proper form answer, so it shows up like any other captured field, and
 * on entry.email.recipient, so a resend can use it right away without
 * re-deriving it. Returns the updated entry; caller upserts it. */
export function withCustomerEmail(entry: Entry, email: string): Entry {
  const trimmed = email.trim();
  const existingIdx = entry.answers.findIndex((a) => a.fieldName === "contact_email");
  const answer: EntryAnswer = {
    fieldName: "contact_email",
    value: trimmed,
    source: "voice",
    manuallyCorrected: false,
    timestamp: new Date().toISOString(),
  };
  const answers =
    existingIdx === -1
      ? [...entry.answers, answer]
      : entry.answers.map((a, i) => (i === existingIdx ? answer : a));
  return { ...entry, answers, email: { ...entry.email, recipient: trimmed } };
}

/** Marks the entry's email as sent to `recipient` and appends an audit
 * entry — the actual "resend" write. Returns the updated entry; caller
 * upserts it. */
export function withEmailResent(entry: Entry, recipient: string): Entry {
  return {
    ...entry,
    email: { status: "sent", recipient, sentAt: new Date().toISOString() },
    audit: [
      ...entry.audit,
      {
        id: `audit_${entry.id}_${Date.now()}`,
        type: "email_resent",
        message: `Email resent to ${recipient}`,
        timestamp: new Date().toISOString(),
        actor: currentUser.name,
      },
    ],
  };
}
