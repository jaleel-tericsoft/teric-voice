"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntriesTable } from "@/components/entries/entries-table";
import { ColumnsDrawer } from "@/components/entries/columns-drawer";
import { useFormsStore } from "@/lib/forms-store";
import { useEntriesStore } from "@/lib/entries-store";
import { getEntryTableColumns } from "@/lib/form-utils";
import { useColumnVisibility } from "@/lib/use-column-visibility";
import { useEntriesFilterStore } from "@/lib/entries-filter-store";
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
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form");
  const activeForm = forms.find((f) => f.formId === formParam) ?? forms[0];

  const entries = getEntriesForForm(activeForm.id);
  const columns = getEntryTableColumns(activeForm);
  const { visible, apply } = useColumnVisibility(
    `teric-entries-columns:${activeForm.id}`,
    columns.map((c) => c.key)
  );

  // Registers which form's table is actually on screen (so the ambient
  // widget's filterByVoice can resolve against its real columns/options),
  // and resets any active filters back to default the moment the user
  // switches form tabs or leaves this page entirely — a filter that made
  // sense for one form's questions won't necessarily mean anything for
  // another's, and a stale filter silently hiding rows on the next visit
  // would be a nasty surprise.
  const { registerActiveForm, resetFilters } = useEntriesFilterStore();
  useEffect(() => {
    registerActiveForm(activeForm);
    resetFilters();
    return () => {
      registerActiveForm(null);
      resetFilters();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm.id]);

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Entries
          </h1>
          <p className="text-sm text-muted-foreground">
            All entries created across your forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsDrawer columns={columns} visible={visible} onApply={apply} />
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

      {/* key forces a fresh table per form — sort/page are still local
       * state inside EntriesTable, and a stale sort key or page number
       * from the previous form's table wouldn't necessarily mean
       * anything for this one. */}
      <EntriesTable key={activeForm.id} form={activeForm} entries={entries} columnVisibility={visible} />
    </div>
  );
}
