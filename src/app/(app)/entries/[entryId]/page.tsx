"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  User,
  Calendar,
  Hash,
  GitBranch,
  AlertTriangle,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryStatusBadge, EmailStatusBadge } from "@/components/entries/status-badge";
import { PdfAction } from "@/components/entries/pdf-action";
import { ResendEmailButton } from "@/components/entries/resend-email-button";
import { VoiceSessionPanel } from "@/components/entries/voice-session-panel";
import { useEntriesStore } from "@/lib/entries-store";
import { useFormsStore } from "@/lib/forms-store";
import { fieldLabel, formatAnswerValue, isEntryComplete } from "@/lib/form-utils";
import { formatDateTime } from "@/lib/format";
import type { AuditEvent } from "@/types";

const auditLabels: Record<AuditEvent["type"], string> = {
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

export default function EntryDetailPage(props: PageProps<"/entries/[entryId]">) {
  const { entryId } = use(props.params);
  const { getEntryById } = useEntriesStore();
  const { forms } = useFormsStore();
  const entry = getEntryById(entryId);

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Entry not found</h1>
          <p className="text-sm text-muted-foreground">
            This entry doesn&apos;t exist, or hasn&apos;t finished loading.
          </p>
        </div>
        <Link href="/entries" className="text-sm font-medium text-primary hover:underline">
          Back to Entries
        </Link>
      </div>
    );
  }

  const form = forms.find((f) => f.id === entry.formId);
  const version = form?.versions.find((v) => v.version === entry.formVersion);
  const resumable = entry.status === "draft" || entry.status === "in_progress";
  const complete = form ? isEntryComplete(form, entry) : false;

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4">
      <div className="flex items-center gap-3">
        <Link
          href="/entries"
          className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {entry.id}
            </h1>
            <EntryStatusBadge status={entry.status} />
          </div>
          <p className="text-sm text-muted-foreground">{entry.formName}</p>
        </div>
        {resumable && (
          <Button asChild className="rounded-full">
            <Link href={`/voice/${entry.id}`}>
              <Mic className="size-4" />
              Resume
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: Entry info + form data */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Entry information */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-4">
            <InfoItem icon={Hash} label="Entry ID" value={entry.id} />
            <InfoItem
              icon={GitBranch}
              label="Form Version"
              value={`v${entry.formVersion}`}
            />
            <InfoItem icon={User} label="Created By" value={entry.createdBy} />
            <InfoItem
              icon={Calendar}
              label="Created"
              value={formatDateTime(entry.createdAt)}
            />
          </div>

          {/* Form data grouped by section */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">
              Form Data
            </h2>
            <div className="flex flex-col gap-6">
              {version?.sections.map((section) => {
                const sectionAnswers = section.questions
                  .map((q) =>
                    entry.answers.find((a) => a.fieldName === q.fieldName)
                  )
                  .filter(Boolean);
                if (sectionAnswers.length === 0) return null;
                return (
                  <div key={section.id}>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {section.questions.map((q) => {
                        const answer = entry.answers.find(
                          (a) => a.fieldName === q.fieldName
                        );
                        if (!answer) return null;
                        return (
                          <div key={q.id}>
                            <div className="text-xs text-muted-foreground">
                              {fieldLabel(form!, q.fieldName)}
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {formatAnswerValue(form!, answer)}
                              {answer.manuallyCorrected && (
                                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  edited
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice session */}
          {entry.voiceSession && (
            <VoiceSessionPanel session={entry.voiceSession} />
          )}

          {/* Audit history */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">
              Audit History
            </h2>
            <div className="flex flex-col">
              {entry.audit.map((event, idx) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="size-2 shrink-0 rounded-full bg-lime" />
                    {idx < entry.audit.length - 1 && (
                      <span className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-5">
                    <div className="text-sm font-medium text-foreground">
                      {auditLabels[event.type]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {event.message}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {formatDateTime(event.timestamp)} · {event.actor}
                    </div>
                  </div>
                </div>
              ))}
              {entry.audit.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No audit events recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Document + Email */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-foreground">
              Document
            </h2>
            <PdfAction
              status={entry.pdf.status}
              entry={entry}
              form={form}
              variant="detail"
              disabledReason={complete ? undefined : "Complete all required fields to generate a PDF"}
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <Mail className="size-4" />
              Email
            </h2>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-medium text-foreground">
                  {entry.email.recipient || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <EmailStatusBadge status={entry.email.status} />
              </div>
              {entry.email.sentAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span className="font-medium text-foreground">
                    {formatDateTime(entry.email.sentAt)}
                  </span>
                </div>
              )}
              {entry.email.failedReason && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {entry.email.failedReason}
                </p>
              )}
              {entry.email.status === "failed" && (
                <ResendEmailButton />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}
