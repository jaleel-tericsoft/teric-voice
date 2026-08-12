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
import {
  EntryStatusBadge,
  EmailStatusIcon,
  IN_PROGRESS_STATUSES,
} from "@/components/entries/status-badge";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { shortLabel, formatAnswerValue, isEntryComplete, findQuestion } from "@/lib/form-utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Entry, FormDefinition } from "@/types";
import { Inbox, Mic, Eye, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ListFilter } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Sticky-left covers Entry ID plus the first (primary/identifying) entry
// list column — e.g. the vehicle's number plate — so you can always tell
// which row you're looking at while scrolling the rest horizontally.
// Sticky-right is just the Actions column. Widths are fixed so the sticky
// offsets line up exactly.
const ID_COL_WIDTH = "w-28";
const ID_COL_OFFSET = "7rem"; // must match ID_COL_WIDTH (w-28 = 7rem)
const FIRST_COL_WIDTH = "w-40";
// Generic min-width for scrollable columns — the table used to size purely
// to content, which read as cramped once sort/filter icons were added to
// every header; this gives every column room to breathe without pushing
// every ordinary-width screen into needing a horizontal scroll to see the
// last couple of columns.
const COL_MIN_WIDTH = "min-w-[128px]";
const CELL_PAD = "px-4 py-3";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;
type FilterOption = { label: string; value: string };
type FilterState = Record<string, Set<string>>;

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

const EMAIL_FILTER_OPTIONS: FilterOption[] = [
  { label: "Sent", value: "sent" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Not sent", value: "not_sent" },
];

/** Ant Design–style stacked-caret sort indicator: the caret pointing in
 * the active direction lights up, the other stays dim. */
function SortIndicator({ dir }: { dir: SortDir | null }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <ChevronUp
        className={cn("-mb-0.5 size-2.5", dir === "asc" ? "text-teal" : "text-muted-foreground/40")}
        strokeWidth={3}
      />
      <ChevronDown
        className={cn("size-2.5", dir === "desc" ? "text-teal" : "text-muted-foreground/40")}
        strokeWidth={3}
      />
    </span>
  );
}

/** Ant Design–style column filter: a funnel that lights up teal once a
 * filter is active, opening a checkbox list with Reset/OK — selections
 * are staged locally and only take effect on OK, matching antd's table
 * filter dropdown rather than filtering on every click. */
function FilterPopover({
  options,
  selected,
  onApply,
}: {
  options: FilterOption[];
  selected: Set<string>;
  onApply: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(selected);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(new Set(selected));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Filter"
          className={cn(
            "inline-flex size-4 items-center justify-center rounded transition-colors",
            selected.size > 0
              ? "text-teal"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
        >
          <ListFilter className="size-3" strokeWidth={selected.size > 0 ? 3 : 2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 p-2 font-normal normal-case tracking-normal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-normal text-foreground hover:bg-muted"
            >
              <Checkbox
                checked={draft.has(opt.value)}
                onCheckedChange={(checked) => {
                  setDraft((prev) => {
                    const next = new Set(prev);
                    if (checked === true) next.add(opt.value);
                    else next.delete(opt.value);
                    return next;
                  });
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
          <button
            type="button"
            disabled={selected.size === 0 && draft.size === 0}
            onClick={() => {
              setDraft(new Set());
              onApply(new Set());
              setOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Reset
          </button>
          <Button
            size="sm"
            className="h-6 rounded-md px-2.5 text-xs"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Header cell content — column label plus an optional sort toggle and/or
 * filter dropdown, Ant Design table style. Lives inside a <TableHead>; the
 * sticky/border/background classes stay on the TableHead itself. */
function ColumnHeader({
  label,
  sortKey,
  sort,
  onSort,
  filterOptions,
  activeFilter,
  onFilterChange,
}: {
  label: string;
  sortKey?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  filterOptions?: FilterOption[];
  activeFilter?: Set<string>;
  onFilterChange?: (key: string, next: Set<string>) => void;
}) {
  const dir = sortKey && sort?.key === sortKey ? sort.dir : null;
  return (
    <div className="flex items-center gap-1.5">
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="flex items-center gap-1 rounded px-0.5 -mx-0.5 hover:bg-black/5"
        >
          {label}
          <SortIndicator dir={dir} />
        </button>
      ) : (
        <span>{label}</span>
      )}
      {filterOptions && sortKey && onFilterChange && (
        <FilterPopover
          options={filterOptions}
          selected={activeFilter ?? new Set()}
          onApply={(next) => onFilterChange(sortKey, next)}
        />
      )}
    </div>
  );
}

export function EntriesTable({
  form,
  entries,
  columnVisibility,
}: {
  form: FormDefinition;
  entries: Entry[];
  /** Optional columns to hide, from the Columns drawer — keyed the same
   * way as getEntryTableColumns (fieldName, or "createdAt"/"email"/
   * "status"). Missing/true means visible; the mandatory columns (Entry
   * ID, the primary column, Actions) ignore this and always show. */
  columnVisibility: Record<string, boolean>;
}) {
  const isVisible = (key: string) => columnVisibility[key] !== false;
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<FilterState>({});

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setPage(1);
  }

  function setColumnFilter(key: string, values: Set<string>) {
    setFilters((prev) => {
      const next = { ...prev };
      if (values.size === 0) delete next[key];
      else next[key] = values;
      return next;
    });
    setPage(1);
  }

  const [firstCol, ...restColsAll] = form.entryListColumns;
  const filteredEntries = useMemo(() => {
    let result = entries;
    for (const col of form.entryListColumns) {
      const active = filters[col];
      if (!active || active.size === 0) continue;
      result = result.filter((entry) => {
        const value = entry.answers.find((a) => a.fieldName === col)?.value;
        return typeof value === "string" && active.has(value);
      });
    }
    const statusFilter = filters["status"];
    if (statusFilter && statusFilter.size > 0) {
      result = result.filter((entry) =>
        statusFilter.has(IN_PROGRESS_STATUSES.includes(entry.status) ? "in_progress" : "completed")
      );
    }
    const emailFilter = filters["email"];
    if (emailFilter && emailFilter.size > 0) {
      result = result.filter((entry) => emailFilter.has(entry.email.status));
    }
    return result;
  }, [entries, filters, form]);

  const sortedEntries = useMemo(() => {
    if (!sort) return filteredEntries;
    const dirMul = sort.dir === "asc" ? 1 : -1;
    const valueOf = (entry: Entry): string | number => {
      if (sort.key === "id") return entry.id;
      if (sort.key === "createdAt") return new Date(entry.createdAt).getTime();
      if (sort.key === "status") return IN_PROGRESS_STATUSES.includes(entry.status) ? 0 : 1;
      const answer = entry.answers.find((a) => a.fieldName === sort.key);
      return answer ? formatAnswerValue(form, answer) : "";
    };
    return [...filteredEntries].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av < bv) return -1 * dirMul;
      if (av > bv) return 1 * dirMul;
      return 0;
    });
  }, [filteredEntries, sort, form]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEntries = useMemo(
    () => sortedEntries.slice(pageStart, pageStart + pageSize),
    [sortedEntries, pageStart, pageSize]
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

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60">
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
                CELL_PAD,
                ID_COL_WIDTH
              )}
            >
              <ColumnHeader label="Entry ID" sortKey="id" sort={sort} onSort={toggleSort} />
            </TableHead>
            {firstCol && (
              <TableHead
                className={cn(
                  "sticky z-10 border-r border-border/60 bg-muted text-xs font-semibold text-muted-foreground",
                  CELL_PAD,
                  FIRST_COL_WIDTH
                )}
                style={{ left: ID_COL_OFFSET }}
              >
                <ColumnHeader
                  label={findQuestion(form, firstCol)?.columnLabel ?? shortLabel(firstCol)}
                  sortKey={firstCol}
                  sort={sort}
                  onSort={toggleSort}
                  filterOptions={findQuestion(form, firstCol)?.options?.map((o) => ({
                    label: o.label,
                    value: o.value,
                  }))}
                  activeFilter={filters[firstCol]}
                  onFilterChange={setColumnFilter}
                />
              </TableHead>
            )}
            {restColsAll
              .filter((col) => isVisible(col))
              .map((col) => (
                <TableHead
                  key={col}
                  className={cn("text-xs font-semibold text-muted-foreground", CELL_PAD, COL_MIN_WIDTH)}
                >
                  <ColumnHeader
                    label={findQuestion(form, col)?.columnLabel ?? shortLabel(col)}
                    sortKey={col}
                    sort={sort}
                    onSort={toggleSort}
                    filterOptions={findQuestion(form, col)?.options?.map((o) => ({
                      label: o.label,
                      value: o.value,
                    }))}
                    activeFilter={filters[col]}
                    onFilterChange={setColumnFilter}
                  />
                </TableHead>
              ))}
            {isVisible("createdAt") && (
              <TableHead className={cn("text-xs font-semibold text-muted-foreground", CELL_PAD, COL_MIN_WIDTH)}>
                <ColumnHeader label="Entry Date" sortKey="createdAt" sort={sort} onSort={toggleSort} />
              </TableHead>
            )}
            {isVisible("email") && (
              <TableHead className={cn("text-xs font-semibold text-muted-foreground", CELL_PAD, "min-w-[90px]")}>
                <ColumnHeader
                  label="Email"
                  sortKey="email"
                  filterOptions={EMAIL_FILTER_OPTIONS}
                  activeFilter={filters["email"]}
                  onFilterChange={setColumnFilter}
                />
              </TableHead>
            )}
            {isVisible("status") && (
              <TableHead className={cn("text-xs font-semibold text-muted-foreground", CELL_PAD, "min-w-[128px]")}>
                <ColumnHeader
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onSort={toggleSort}
                  filterOptions={STATUS_FILTER_OPTIONS}
                  activeFilter={filters["status"]}
                  onFilterChange={setColumnFilter}
                />
              </TableHead>
            )}
            <TableHead
              className={cn(
                "sticky right-0 z-10 border-l border-border/60 bg-muted text-right text-xs font-semibold text-muted-foreground",
                CELL_PAD
              )}
            >
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
                className="cursor-pointer border-border/60 bg-card"
                onClick={() => router.push(`/entries/${entry.id}`)}
              >
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 border-r border-border/60 bg-card font-mono text-xs font-medium text-muted-foreground",
                    CELL_PAD,
                    ID_COL_WIDTH
                  )}
                >
                  {entry.id}
                </TableCell>
                {firstCol && (
                  <TableCell
                    className={cn(
                      "sticky z-10 border-r border-border/60 bg-card text-sm text-foreground",
                      CELL_PAD,
                      FIRST_COL_WIDTH
                    )}
                    style={{ left: ID_COL_OFFSET }}
                  >
                    {firstAnswer ? formatAnswerValue(form, firstAnswer) : "—"}
                  </TableCell>
                )}
                {restColsAll
                  .filter((col) => isVisible(col))
                  .map((col) => {
                    const answer = entry.answers.find((a) => a.fieldName === col);
                    return (
                      <TableCell key={col} className={cn("text-sm text-foreground", CELL_PAD, COL_MIN_WIDTH)}>
                        {answer ? formatAnswerValue(form, answer) : "—"}
                      </TableCell>
                    );
                  })}
                {isVisible("createdAt") && (
                  <TableCell className={cn("text-sm text-muted-foreground", CELL_PAD, COL_MIN_WIDTH)}>
                    {formatDate(entry.createdAt)}
                  </TableCell>
                )}
                {isVisible("email") && (
                  <TableCell className={CELL_PAD}>
                    <EmailStatusIcon status={entry.email.status} />
                  </TableCell>
                )}
                {isVisible("status") && (
                  <TableCell className={CELL_PAD}>
                    <EntryStatusBadge status={entry.status} simple />
                  </TableCell>
                )}
                <TableCell
                  className={cn(
                    "sticky right-0 z-10 border-l border-border/60 bg-card text-right",
                    CELL_PAD
                  )}
                >
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
                      <ResendEmailIconButton entry={entry} />
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

      {/* Footer: page size + range + pager — same bg as the header so the
       * table reads as one bordered surface with header/footer bookends. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-border/60 bg-muted px-4 py-3 text-xs text-muted-foreground">
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
            {sortedEntries.length === 0 ? 0 : pageStart + 1}–
            {Math.min(pageStart + pageSize, sortedEntries.length)} of {sortedEntries.length}{" "}
            {sortedEntries.length === 1 ? "entry" : "entries"}
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
