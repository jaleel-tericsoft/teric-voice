"use client";

import Link from "next/link";
import { Plus, MoreHorizontal, Layers, ListTree, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormsStore } from "@/lib/forms-store";
import { getAllQuestions } from "@/lib/form-utils";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const statusStyles: Record<string, string> = {
  active: "bg-success/15 text-success",
  draft: "bg-warning/15 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export default function FormBuilderPage() {
  const { forms, setFormStatus } = useFormsStore();

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Form Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Design the forms your voice assistant collects data with.
          </p>
        </div>
        <Button asChild className="rounded-full">
          <Link href="/form-builder/new">
            <Plus className="size-4" />
            Create Form
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => {
          const questionCount = getAllQuestions(form).length;
          const isDraft = form.status === "draft";
          return (
            <div
              key={form.id}
              className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Layers className="size-[18px]" />
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="px-2 py-1.5" asChild>
                      <Link href={`/form-builder/new?edit=${form.formId}`}>
                        <ListTree className="size-4" />
                        Edit Questions
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="px-2 py-1.5" disabled>
                      <Copy className="size-4" />
                      Duplicate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {form.name}
                  </h3>
                  <Badge
                    variant="ghost"
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      statusStyles[form.status]
                    )}
                  >
                    {form.status}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {form.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>v{form.currentVersion}</span>
                <span>·</span>
                <span>{questionCount} questions</span>
                <span>·</span>
                <span>{form.totalEntries} entries</span>
              </div>

              {/* Active/inactive lives here now, not inside the editor —
               * the one place a form's live-or-not state is toggled.
               * Disabled while still a draft: a draft isn't voice-fillable
               * yet regardless of this switch, so flipping it here would
               * be misleading — finish it in the editor (Publish) first. */}
              <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
                <span className="text-xs font-medium text-foreground">
                  {isDraft ? "Publish from the editor to activate" : "Active"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Switch
                        size="sm"
                        checked={form.status === "active"}
                        disabled={isDraft}
                        onCheckedChange={(checked) =>
                          setFormStatus(form.id, checked ? "active" : "inactive")
                        }
                        aria-label={form.status === "active" ? "Deactivate form" : "Activate form"}
                      />
                    </span>
                  </TooltipTrigger>
                  {isDraft && (
                    <TooltipContent side="top">
                      Still a draft — publish it from the editor first
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Updated {formatDate(form.updatedAt)}
                </span>
                <Link
                  href={`/entries?form=${form.formId}`}
                  className="text-xs font-medium text-foreground hover:underline"
                >
                  View entries →
                </Link>
              </div>
            </div>
          );
        })}

        {/* Create new card */}
        <Link
          href="/form-builder/new"
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-medium">Create a new form</span>
        </Link>
      </div>
    </div>
  );
}
