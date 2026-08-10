import { Check, X, Mail, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EmailStatus, EntryStatus } from "@/types";

const entryStatusConfig: Record<
  EntryStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  in_progress: {
    label: "In Progress",
    className: "bg-info/10 text-info",
  },
  awaiting_review: {
    label: "Awaiting Review",
    className: "bg-warning/15 text-warning",
  },
  submitted: {
    label: "Submitted",
    className: "bg-primary/10 text-primary",
  },
  pdf_generated: {
    label: "PDF Generated",
    className: "bg-lime/25 text-lime-foreground",
  },
  email_sent: {
    label: "Email Sent",
    className: "bg-success/15 text-success",
  },
  email_failed: {
    label: "Email Failed",
    className: "bg-destructive/10 text-destructive",
  },
};

// Every status other than draft/in_progress represents a finished
// conversation (submitted, however far it's gotten through PDF/email) —
// grouped down to two states wherever the table just needs "is this one
// still being worked on or not".
const IN_PROGRESS_STATUSES: EntryStatus[] = ["draft", "in_progress"];

export function EntryStatusBadge({
  status,
  simple = false,
}: {
  status: EntryStatus;
  /** Collapses every status down to just "Completed" / "In Progress" —
   * used in the entries table, where the granular status is more detail
   * than the column needs. */
  simple?: boolean;
}) {
  if (simple) {
    const inProgress = IN_PROGRESS_STATUSES.includes(status);
    return (
      <Badge
        variant="ghost"
        className={cn(
          // pointer-events-none: these are informational chips, not
          // controls — without it, Badge's "ghost" variant applies its
          // hover state (a color/background swap meant for interactive
          // use) just from the mouse passing over it, which looked like
          // the status was changing.
          "pointer-events-none rounded-full px-2.5 py-1 font-medium",
          inProgress ? "bg-info/10 text-info" : "bg-success/15 text-success"
        )}
      >
        {inProgress ? "In Progress" : "Completed"}
      </Badge>
    );
  }

  const cfg = entryStatusConfig[status];
  return (
    <Badge
      variant="ghost"
      className={cn("pointer-events-none rounded-full px-2.5 py-1 font-medium", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}

const emailStatusConfig: Record<
  EmailStatus,
  { label: string; className: string }
> = {
  sent: { label: "Sent", className: "bg-success/15 text-success" },
  pending: { label: "Pending", className: "bg-warning/15 text-warning" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  not_sent: { label: "Not sent", className: "bg-muted text-muted-foreground" },
};

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const cfg = emailStatusConfig[status];
  return (
    <Badge
      variant="ghost"
      className={cn("pointer-events-none rounded-full px-2.5 py-1 font-medium", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}

const emailStatusIconConfig: Record<
  EmailStatus,
  { icon: typeof Check; label: string; className: string }
> = {
  sent: { icon: Check, label: "Email sent", className: "bg-success/15 text-success" },
  failed: { icon: X, label: "Email failed", className: "bg-destructive/10 text-destructive" },
  pending: { icon: Clock, label: "Email pending", className: "bg-warning/15 text-warning" },
  not_sent: { icon: Mail, label: "Not sent", className: "bg-muted text-muted-foreground" },
};

/** Compact icon form of email status for table rows — a tick, a cross, a
 * clock, or a plain envelope, with the real label on hover instead of
 * spelling it out inline every row. */
export function EmailStatusIcon({ status }: { status: EmailStatus }) {
  const cfg = emailStatusIconConfig[status];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full",
            cfg.className
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.5} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{cfg.label}</TooltipContent>
    </Tooltip>
  );
}
