"use client";

import { useEffect, useState } from "react";

/** Persists which optional entries-table columns are shown, per form, in
 * localStorage — so a choice made in the Columns drawer stays applied on
 * later visits, not just for the current session.
 *
 * State starts as "everything visible" on every render (matching what a
 * server render would produce, since localStorage isn't available there)
 * and only swaps in the saved preference from an effect after mount. This
 * two-step load avoids a hydration mismatch — the alternative, reading
 * localStorage inside the initial useState, would make the client's first
 * render disagree with the server's. */
export function useColumnVisibility(storageKey: string, allKeys: string[]) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allKeys.map((k) => [k, true]))
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        // Reading localStorage has to happen post-mount no matter what —
        // it doesn't exist during SSR, so there's no version of this read
        // that could move to render without itself causing the mismatch
        // this hook exists to avoid. That's the "read from an external
        // store" case the lint rule's own guidance calls out as expected
        // to setState in an effect; it just can't verify that from here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(Object.fromEntries(allKeys.map((k) => [k, saved[k] ?? true])));
      }
    } catch {
      // Malformed or inaccessible storage — fall back to "everything visible".
    }
    // Only re-run if the storage key itself changes (e.g. a different
    // form); allKeys is derived fresh each render and would otherwise
    // retrigger this every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function apply(next: Record<string, boolean>) {
    setVisible(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage unavailable (private browsing, quota) — selection still
      // applies for the current session via state.
    }
  }

  return { visible, apply };
}
