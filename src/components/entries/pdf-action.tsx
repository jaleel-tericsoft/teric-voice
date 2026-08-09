"use client";

import { FileText, Loader2, Eye, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntryPdf } from "@/hooks/use-entry-pdf";
import type { Entry, FormDefinition, PdfStatus } from "@/types";

export function PdfAction({
  status,
  entry,
  form,
  variant = "compact",
}: {
  status: PdfStatus;
  entry: Entry;
  form: FormDefinition | undefined;
  variant?: "compact" | "detail";
}) {
  const pdfState = useEntryPdf(entry, form, status);

  if (pdfState.status === "generating") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled
        className="rounded-full text-xs"
      >
        <Loader2 className="size-3.5 animate-spin" />
        Generating…
      </Button>
    );
  }

  if (pdfState.error) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full text-xs text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            pdfState.generate();
          }}
        >
          <AlertTriangle className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (pdfState.status === "generated") {
    if (variant === "detail") {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Eye className="size-6" />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 rounded-full text-xs"
              onClick={() => pdfState.view()}
            >
              <Eye className="size-3.5" />
              View
            </Button>
            <Button
              variant="secondary"
              className="flex-1 rounded-full text-xs"
              onClick={() => pdfState.download()}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </div>
          <Button
            variant="ghost"
            className="rounded-full text-xs text-muted-foreground"
            onClick={() => pdfState.generate()}
          >
            <RefreshCw className="size-3.5" />
            Regenerate PDF
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            pdfState.view();
          }}
        >
          <Eye className="size-3.5" />
          View
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Download PDF"
          className="rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            pdfState.download();
          }}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Regenerate PDF"
          className="rounded-full text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            pdfState.generate();
          }}
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="rounded-full text-xs"
      onClick={(e) => {
        e.stopPropagation();
        pdfState.generate();
      }}
    >
      <FileText className="size-3.5" />
      Generate PDF
    </Button>
  );
}
