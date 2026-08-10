"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntryStatusBadge, EmailStatusIcon } from "@/components/entries/status-badge";
import { PdfAction } from "@/components/entries/pdf-action";
import { ResendEmailIconButton } from "@/components/entries/resend-email-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortLabel, formatAnswerValue, isEntryComplete, findQuestion } from "@/lib/form-utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Entry, FormDefinition } from "@/types";
import { Inbox, Mic, Eye, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Sticky-left covers Entry ID plus the first (primary/identifying) entry
// list column — e.g. the vehicle's number plate — so you can always tell
// which row you're looking at while scrolling the rest horizontally.
// Sticky-right is just the Actions column. Widths are fixed so the sticky
// offsets line up exactly.
const ID_COL_WIDTH = "w-28";
const ID_COL_OFFSET = "7rem"; // must match ID_COL_WIDTH (w-28 = 7rem)
const FIRST_COL_WIDTH = "w-36";

export function EntriesTable({
  form,
  entries,
}: {
  form: FormDefinition;
  entries: Entry[];
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEntries = useMemo(
    () => entries.slice(pageStart, pageStart + pageSize),
    [entries, pageStart, pageSize]
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            No entries yet for {form.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Entries created from this form will show up here.
          </p>
        </div>
      </div>
    );
  }

  const [firstCol, ...restCols] = form.entryListColumns;

  return (
    <div className="rounded-2xl border border-border/60">
      {/* The shared Table primitive defaults its inner <table> to w-full,
       * which just compresses columns to fit instead of overflowing — that
       * defeats sticky-column scrolling, so it's overridden to size to its
       * content (w-max) here so there's something to actually scroll. */}
      <Table className="w-max min-w-full">
        <TableHeader>
            <TableRow className="border-border/60 bg-muted hover:bg-muted">
              <TableHead
                className={cn(
                  "sticky left-0 z-10 border-r border-border/60 bg-muted pl-4 text-xs font-semibold text-muted-foreground",
                  ID_COL_WIDTH
                )}
              >
                Entry ID
              </TableHead>
              {firstCol && (
                <TableHead
                  className={cn(
                    "sticky z-10 border-r border-border/60 bg-muted text-xs font-semibold text-muted-foreground",
                    FIRST_COL_WIDTH
                  )}
                  style={{ left: ID_COL_OFFSET }}
                >
                  {findQuestion(form, firstCol)?.columnLabel ?? shortLabel(firstCol)}
                </TableHead>
              )}
              {restCols.map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {findQuestion(form, col)?.columnLabel ?? shortLabel(col)}
                </TableHead>
              ))}
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Entry Date
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="sticky right-0 z-10 border-l border-border/60 bg-muted pr-4 text-right text-xs font-semibold text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageEntries.map((entry) => {
              const resumable = entry.status === "draft" || entry.status === "in_progress";
              const complete = isEntryComplete(form, entry);
              const firstAnswer = firstCol
                ? entry.answers.find((a) => a.fieldName === firstCol)
                : undefined;
              return (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer border-border/60"
                  onClick={() => router.push(`/entries/${entry.id}`)}
                >
                  <TableCell
                    className={cn(
                      "sticky left-0 z-10 border-r border-border/60 bg-card pl-4 font-mono text-xs font-medium text-muted-foreground",
                      ID_COL_WIDTH
                    )}
                  >
                    {entry.id}
                  </TableCell>
                  {firstCol && (
                    <TableCell
                      className={cn(
                        "sticky z-10 border-r border-border/60 bg-card text-sm text-foreground",
                        FIRST_COL_WIDTH
                      )}
                      style={{ left: ID_COL_OFFSET }}
                    >
                      {firstAnswer ? formatAnswerValue(form, firstAnswer) : "—"}
                    </TableCell>
                  )}
                  {restCols.map((col) => {
                    const answer = entry.answers.find((a) => a.fieldName === col);
                    return (
                      <TableCell key={col} className="text-sm text-foreground">
                        {answer ? formatAnswerValue(form, answer) : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <EmailStatusIcon status={entry.email.status} />
                  </TableCell>
                  <TableCell>
                    <EntryStatusBadge status={entry.status} simple />
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 border-l border-border/60 bg-card pr-4 text-right">
                    {resumable ? (
                      <Button
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/voice/${entry.id}`);
                        }}
                      >
                        <Mic className="size-3.5" />
                        Resume
                      </Button>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <ResendEmailIconButton entry={entry.id} />
                        <PdfAction
                          status={entry.pdf.status}
                          entry={entry}
                          form={form}
                          disabledReason={
                            complete ? undefined : "Complete all required fields to generate a PDF"
                          }
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Open entry"
                              className="rounded-full text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/entries/${entry.id}`);
                              }}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open entry</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

      {/* Footer: page size + range + pager */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[68px] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span>
            {pageStart + 1}–{Math.min(pageStart + pageSize, entries.length)} of {entries.length}{" "}
            {entries.length === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
