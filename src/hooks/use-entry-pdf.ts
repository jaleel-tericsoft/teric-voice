"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateEntryPdfBlob } from "@/lib/pdf";
import { organization } from "@/lib/mock-data";
import type { Entry, FormDefinition, PdfStatus } from "@/types";

/** Generates (and caches) a real PDF blob for an entry on demand — shared
 * between the compact Entries-table action and the Entry Detail document
 * card, so "View"/"Download" always open an actual rendered PDF instead of
 * being a UI stub. */
export function useEntryPdf(
  entry: Entry,
  form: FormDefinition | undefined,
  initialStatus: PdfStatus
) {
  const [status, setStatus] = useState<PdfStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
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
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setStatus("generated");
      return url;
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

  const view = useCallback(async () => {
    const url = await ensureUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [ensureUrl]);

  const download = useCallback(async () => {
    const url = await ensureUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [ensureUrl, entry.id]);

  return { status, error, generate, view, download };
}
