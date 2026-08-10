"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateEntryPdfBlob } from "@/lib/pdf";
import { organization } from "@/lib/mock-data";
import type { Entry, FormDefinition, PdfStatus } from "@/types";

/** Generates (and caches) a real PDF blob for an entry — shared between the
 * compact Entries-table action and the Entry Detail document card. There's
 * no manual "Generate" step for the user: a complete entry's PDF is meant
 * to just exist, generated transparently either eagerly (pass `auto: true`,
 * used by the Document card so it's already showing when the page opens)
 * or lazily on first download (used by the table, which doesn't want to
 * eagerly render a PDF for every row just because the list is open). */
export function useEntryPdf(
  entry: Entry,
  form: FormDefinition | undefined,
  initialStatus: PdfStatus,
  opts: { auto?: boolean } = {}
) {
  const [status, setStatus] = useState<PdfStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const generate = useCallback(async (): Promise<string | null> => {
    if (!form) {
      setError("Form definition not found");
      return null;
    }
    setStatus("generating");
    setError(null);
    try {
      const blob = await generateEntryPdfBlob(entry, form, organization);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const newUrl = URL.createObjectURL(blob);
      urlRef.current = newUrl;
      setUrl(newUrl);
      setStatus("generated");
      return newUrl;
    } catch (err) {
      console.error("[pdf] generation failed", err);
      setError(err instanceof Error ? err.message : "PDF generation failed");
      setStatus("not_generated");
      return null;
    }
  }, [entry, form]);

  const ensureUrl = useCallback(async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    return generate();
  }, [generate]);

  useEffect(() => {
    // Check the ref, not `status` — a stale mock pdf.status of "generated"
    // (seed data with no real blob behind it) would otherwise convince this
    // nothing needs generating, and the auto-view would spin forever with
    // no url to actually show. A fresh hook instance never has a real
    // cached blob, so this only ever skips a genuinely-in-flight/complete
    // generation from this same instance.
    if (opts.auto && !urlRef.current && !error) generate();
    // Only re-runs if auto flips on, not on every generate/status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.auto]);

  const view = useCallback(async () => {
    const u = await ensureUrl();
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  }, [ensureUrl]);

  const download = useCallback(async () => {
    const u = await ensureUrl();
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.download = `${entry.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ensureUrl, entry.id]);

  return { status, error, url, generate, view, download };
}
