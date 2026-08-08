import { Badge } from "@/components/ui/badge";
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

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const cfg = entryStatusConfig[status];
  return (
    <Badge
      variant="ghost"
      className={cn("rounded-full px-2.5 py-1 font-medium", cfg.className)}
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
      className={cn("rounded-full px-2.5 py-1 font-medium", cfg.className)}
    >
      {cfg.label}
    </Badge>
  );
}
