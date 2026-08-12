"use client";

import { useState } from "react";
import { useEntriesStore, resolveRecipientEmail, withCustomerEmail, withEmailResent } from "@/lib/entries-store";
import type { Entry } from "@/types";

export type ResendState = "idle" | "sending" | "sent";

/** Drives both the entries table's icon-only resend button and the entry
 * detail page's full resend button off the same logic: resolve a
 * recipient (or take one just collected from the user), then actually
 * write the send back to the entry — not just flip a local button state.
 * Also what the ambient voice widget's resend_pdf_email/
 * record_customer_email tools call into, so voice and click stay
 * consistent. */
export function useResendEmail(entry: Entry) {
  const { upsertEntry } = useEntriesStore();
  const [state, setState] = useState<ResendState>("idle");
  const recipient = resolveRecipientEmail(entry);

  function send(emailOverride?: string) {
    const target = (emailOverride ?? recipient).trim();
    if (!target) return; // caller is responsible for collecting one first

    setState("sending");
    // No real email backend exists yet — simulate the round-trip the same
    // way the rest of this app's not-yet-wired actions do, but the write
    // at the end is real: the entry's email status and audit trail update
    // for good, not just local button state.
    window.setTimeout(() => {
      let updated = entry;
      if (emailOverride && emailOverride.trim() !== entry.email.recipient) {
        updated = withCustomerEmail(updated, emailOverride.trim());
      }
      updated = withEmailResent(updated, target);
      upsertEntry(updated);
      setState("sent");
    }, 1200);
  }

  return { recipient, state, send };
}
