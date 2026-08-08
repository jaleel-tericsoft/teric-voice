import Link from "next/link";
import {
  Inbox,
  CheckCircle2,
  Clock,
  Mail,
  Mic,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { EntryStatusBadge } from "@/components/entries/status-badge";
import { dashboardStats, entries, forms, currentUser } from "@/lib/mock-data";
import { timeAgo } from "@/lib/format";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const recent = [...entries]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pt-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a4326] via-[#4a2a1c] to-[#241713] px-8 py-9 text-white">
        <div className="relative z-10 flex max-w-lg flex-col gap-4">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
            Voice Assistant
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Good to see you, {currentUser.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-white/70">
            Kick off a new entry hands-free — the assistant asks the
            questions, listens, and fills the form as you speak.
          </p>
          <Link
            href="/voice/new?form=employee-information"
            className="flex w-fit items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-lime-foreground transition-transform active:scale-[0.98]"
          >
            <Mic className="size-4" strokeWidth={2.5} />
            Start Voice Form
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-10 top-1/2 size-64 -translate-y-1/2 rounded-full bg-lime/20 blur-3xl" />
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
          icon={Clock}
          label="Pending / In Progress"
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
            {recent.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className="flex items-center justify-between gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-muted"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-foreground">
                    {initials(
                      String(
                        entry.answers.find((a) => a.fieldName === "full_name")
                          ?.value ?? entry.id
                      )
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {entry.answers.find((a) => a.fieldName === "full_name")
                        ?.value
                        ? String(
                            entry.answers.find(
                              (a) => a.fieldName === "full_name"
                            )?.value
                          )
                        : entry.id}
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
            ))}
          </div>
        </div>

        {/* Form activity */}
        <div className="rounded-2xl bg-secondary/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-lime text-lime-foreground">
              <Mic className="size-3" strokeWidth={2.5} />
            </span>
            <h2 className="text-[15px] font-semibold text-foreground">
              Form activity
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            {forms.map((form) => {
              const count = entries.filter(
                (e) => e.formId === form.id
              ).length;
              const max = Math.max(...forms.map((f) =>
                entries.filter((e) => e.formId === f.id).length
              ), 1);
              return (
                <Link
                  key={form.id}
                  href={`/entries?form=${form.formId}`}
                  className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-foreground">
                        {form.name}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/70">
                      <div
                        className="h-full rounded-full bg-lime"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
