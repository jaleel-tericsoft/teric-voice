"use client";

import { Loader2, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEntryPdf } from "@/hooks/use-entry-pdf";
import type { Entry, FormDefinition, PdfStatus } from "@/types";

export function PdfAction({
  status,
  entry,
  form,
  variant = "compact",
  disabledReason,
}: {
  status: PdfStatus;
  entry: Entry;
  form: FormDefinition | undefined;
  variant?: "compact" | "detail";
  /** When set, there isn't a complete enough entry to produce a real PDF
   * from yet — e.g. required fields still missing. Pass undefined once the
   * entry is complete. */
  disabledReason?: string;
}) {
  // The detail view auto-generates the moment the entry is complete, so the
  // document just shows up — no manual "Generate" step anywhere.
  const pdfState = useEntryPdf(entry, form, status, { auto: variant === "detail" && !disabledReason });

  if (disabledReason && pdfState.status !== "generated") {
    if (variant === "detail") {
      return (
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted px-4 text-center text-xs text-muted-foreground">
          {disabledReason}
        </div>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              size="icon-sm"
              variant="ghost"
              disabled
              aria-label="Download PDF"
              className="rounded-full text-muted-foreground"
            >
              <Download className="size-3.5" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  if (pdfState.error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={variant === "detail" ? "sm" : "icon-sm"}
            variant="ghost"
            aria-label="Retry generating PDF"
            className="rounded-full text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              pdfState.generate();
            }}
          >
            <AlertTriangle className="size-3.5" />
            {variant === "detail" && "Retry"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pdfState.error} — click to retry</TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "detail") {
    return (
      <div className="flex flex-col gap-3">
        {pdfState.status === "generated" && pdfState.url ? (
          <iframe
            src={pdfState.url}
            title={`${entry.id} document`}
            className="aspect-[3/4] w-full rounded-xl border border-border/60 bg-background"
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-full text-xs"
            disabled={pdfState.status !== "generated"}
            onClick={() => pdfState.download()}
          >
            <Download className="size-3.5" />
            Download
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-xs text-muted-foreground"
            onClick={() => pdfState.generate()}
          >
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </div>
    );
  }

  // Compact (table row): a single Download icon — clicking it generates the
  // PDF first if it isn't cached yet, transparently, no separate step.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Download PDF"
          className="rounded-full text-muted-foreground"
          disabled={pdfState.status === "generating"}
          onClick={(e) => {
            e.stopPropagation();
            pdfState.download();
          }}
        >
          {pdfState.status === "generating" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Download PDF</TooltipContent>
    </Tooltip>
  );
}
