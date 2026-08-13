// Single source of truth for how an AuditEvent renders — label + icon —
// shared by the entry detail page's Audit History timeline and the
// dashboard's Form Activity feed, so the two never drift into describing
// the same event types differently.

import {
  Mic,
  MessageCircle,
  CheckCircle2,
  Pencil,
  FileEdit,
  FilePlus,
  FileText,
  Mail,
  MailWarning,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { AuditEvent } from "@/types";

export const auditLabels: Record<AuditEvent["type"], string> = {
  session_started: "Session Started",
  question_asked: "Question Asked",
  answer_captured: "Answer Captured",
  answer_corrected: "Answer Corrected",
  field_manually_edited: "Field Manually Edited",
  form_completed: "Form Completed",
  entry_created: "Entry Created",
  pdf_generated: "PDF Generated",
  email_sent: "Email Sent",
  email_failed: "Email Failed",
  email_resent: "Email Resent",
};

export const auditIcons: Record<AuditEvent["type"], LucideIcon> = {
  session_started: Mic,
  question_asked: MessageCircle,
  answer_captured: CheckCircle2,
  answer_corrected: Pencil,
  field_manually_edited: FileEdit,
  form_completed: CheckCircle2,
  entry_created: FilePlus,
  pdf_generated: FileText,
  email_sent: Mail,
  email_failed: MailWarning,
  email_resent: Send,
};
