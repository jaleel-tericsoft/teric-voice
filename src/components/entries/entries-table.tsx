"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntryStatusBadge, EmailStatusBadge } from "@/components/entries/status-badge";
import { PdfAction } from "@/components/entries/pdf-action";
import { shortLabel, getAnswerValue } from "@/lib/form-utils";
import { formatDate } from "@/lib/format";
import type { Entry, FormDefinition } from "@/types";
import { Inbox } from "lucide-react";

export function EntriesTable({
  form,
  entries,
}: {
  form: FormDefinition;
  entries: Entry[];
}) {
  const router = useRouter();

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
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted hover:bg-muted">
            <TableHead className="pl-4 text-xs font-semibold text-muted-foreground">
              Entry ID
            </TableHead>
            {form.entryListColumns.map((col) => (
              <TableHead
                key={col}
                className="text-xs font-semibold text-muted-foreground"
              >
                {shortLabel(col)}
              </TableHead>
            ))}
            <TableHead className="text-xs font-semibold text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">
              Email
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground">
              PDF
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer border-border/60"
              onClick={() => router.push(`/entries/${entry.id}`)}
            >
              <TableCell className="pl-4 font-mono text-xs font-medium text-muted-foreground">
                {entry.id}
              </TableCell>
              {form.entryListColumns.map((col) => (
                <TableCell key={col} className="text-sm text-foreground">
                  {getAnswerValue(entry.answers, col)}
                </TableCell>
              ))}
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(entry.createdAt)}
              </TableCell>
              <TableCell>
                <EmailStatusBadge status={entry.email.status} />
              </TableCell>
              <TableCell>
                <EntryStatusBadge status={entry.status} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <PdfAction status={entry.pdf.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
