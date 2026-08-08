"use client";

import { useState } from "react";
import { FileText, Loader2, Eye, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PdfStatus } from "@/types";

export function PdfAction({ status: initial }: { status: PdfStatus }) {
  const [status, setStatus] = useState<PdfStatus>(initial);

  if (status === "generating") {
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

  if (status === "generated") {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="size-3.5" />
          View
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Download PDF"
          className="rounded-full"
          onClick={(e) => e.stopPropagation()}
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
            setStatus("generating");
            setTimeout(() => setStatus("generated"), 1400);
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
        setStatus("generating");
        setTimeout(() => setStatus("generated"), 1400);
      }}
    >
      <FileText className="size-3.5" />
      Generate PDF
    </Button>
  );
}
