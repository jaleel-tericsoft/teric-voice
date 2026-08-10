"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntriesTable } from "@/components/entries/entries-table";
import { useFormsStore } from "@/lib/forms-store";
import { useEntriesStore } from "@/lib/entries-store";
import { entryMatchesQuery } from "@/lib/form-utils";
import { cn } from "@/lib/utils";

export default function EntriesPage() {
  return (
    <Suspense fallback={null}>
      <EntriesPageContent />
    </Suspense>
  );
}

function EntriesPageContent() {
  const { forms } = useFormsStore();
  const { getEntriesForForm } = useEntriesStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form");
  const activeForm = forms.find((f) => f.formId === formParam) ?? forms[0];
  const query = searchParams.get("q") ?? "";

  const allEntries = getEntriesForForm(activeForm.id);
  const entries = query
    ? allEntries.filter((entry) => entryMatchesQuery(activeForm, entry, query))
    : allEntries;

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const qs = params.toString();
    router.push(qs ? `/entries?${qs}` : "/entries");
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Entries
          </h1>
          <p className="text-sm text-muted-foreground">
            {query ? (
              <span className="inline-flex items-center gap-1.5">
                Showing results for <span className="font-medium text-foreground">“{query}”</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" /> Clear
                </button>
              </span>
            ) : (
              "All entries created across your forms."
            )}
          </p>
        </div>
        {activeForm.status === "active" ? (
          <Button asChild className="rounded-full">
            <Link href={`/voice/new?form=${activeForm.formId}`}>
              <Plus className="size-4" />
              New Entry
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            className="rounded-full"
            title={
              activeForm.status === "draft"
                ? "Publish this form from Form Builder before adding entries"
                : "This form is deactivated and isn't accepting entries"
            }
          >
            <Plus className="size-4" />
            New Entry
          </Button>
        )}
      </div>

      {/* Form tabs */}
      <div className="flex items-center gap-6 overflow-x-auto border-b border-border">
        {forms.map((form) => {
          const isActive = form.id === activeForm.id;
          return (
            <Link
              key={form.id}
              href={`/entries?form=${form.formId}`}
              className={cn(
                "relative -mb-px flex shrink-0 items-center pb-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {form.name}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-lime" />
              )}
            </Link>
          );
        })}
      </div>

      {query && entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No entries match “{query}”</p>
          <p className="text-xs text-muted-foreground">Try a different plate, name, or contact number.</p>
        </div>
      ) : (
        <EntriesTable form={activeForm} entries={entries} />
      )}
    </div>
  );
}
