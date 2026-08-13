"use client";

import Link from "next/link";
import {
  Inbox,
  CheckCircle2,
  FileEdit,
  Mail,
  Mic,
  ArrowUpRight,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { StartVoiceFormButton } from "@/components/layout/start-voice-form-button";
import { EntryStatusBadge } from "@/components/entries/status-badge";
import { currentUser } from "@/lib/mock-data";
import { useEntriesStore } from "@/lib/entries-store";
import { timeAgo } from "@/lib/format";
import { auditLabels, auditIcons } from "@/lib/audit";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const { entries, stats: dashboardStats } = useEntriesStore();
  const recent = [...entries]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);
  // Every audit event across every entry, newest first — real activity
  // (a PDF generated, an email sent, a draft saved) rather than just a
  // per-form entry count, and it's reactive to `entries` the same way the
  // stat cards above are: a brand new form starts here with nothing, and
  // fills in the moment its first session does anything.
  const activity = entries
    .flatMap((entry) => entry.audit.map((event) => ({ event, entry })))
    .sort((a, b) => +new Date(b.event.timestamp) - +new Date(a.event.timestamp))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6 pt-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#102a43] via-[#0f2438] to-[#0b1f33] px-8 py-9 text-white">
        <div className="relative z-10 flex max-w-lg flex-col gap-4">
          <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
            Voice Assistant
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Good to see you, {currentUser.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-white/70">
            Kick off a new entry hands-free — the assistant asks the
            questions, listens, and fills the form as you speak.
          </p>
          <StartVoiceFormButton className="flex w-fit items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-teal-foreground transition-transform hover:bg-[#256b76] active:scale-[0.98]" />
        </div>
        <div className="pointer-events-none absolute -right-10 top-1/2 size-64 -translate-y-1/2 rounded-full bg-[#1f5a63]/30 blur-3xl" />
        <div className="pointer-events-none absolute right-6 top-1/2 size-40 -translate-y-1/2 rounded-full border border-white/15" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Total Entries"
          value={dashboardStats.totalEntries}
          tone="default"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={dashboardStats.completedEntries}
          tone="lime"
        />
        <StatCard
          icon={FileEdit}
          label="Draft"
          value={dashboardStats.pendingEntries}
          tone="warn"
        />
        <StatCard
          icon={Mail}
          label="Emails Sent"
          value={dashboardStats.emailsSent}
          hint={
            dashboardStats.emailsFailed > 0
              ? `${dashboardStats.emailsFailed} failed`
              : undefined
          }
          tone="default"
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent entries */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">
              Recent entries
            </h2>
            <Link
              href="/entries"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              See all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="flex flex-col">
            {recent.map((entry) => {
              const plate = entry.answers.find((a) => a.fieldName === "number_plate")?.value;
              const label = plate ? String(plate) : entry.id;
              return (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-foreground">
                      {initials(label)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {label}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {entry.formName} · {entry.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {timeAgo(entry.createdAt)}
                    </span>
                    <EntryStatusBadge status={entry.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Form activity */}
        <div className="rounded-2xl border border-border/60 bg-muted p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mic className="size-3" strokeWidth={2.5} />
            </span>
            <h2 className="text-[15px] font-semibold text-foreground">
              Form activity
            </h2>
          </div>
          <div className="flex flex-col">
            {activity.map(({ event, entry }) => {
              const Icon = auditIcons[event.type];
              return (
                <Link
                  // event.id is only unique within one entry's own audit
                  // array (seed data reuses "a1", "a2"... per entry) —
                  // this feed flattens events across every entry, so it
                  // needs the entry folded into the key too.
                  key={`${entry.id}-${event.id}`}
                  href={`/entries/${entry.id}`}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-background"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {auditLabels[event.type]}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(event.timestamp)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {entry.formName} · {event.message}
                    </div>
                  </div>
                </Link>
              );
            })}
            {activity.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No activity yet — it&apos;ll show up here as entries move through the workflow.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
