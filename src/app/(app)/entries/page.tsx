import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntriesTable } from "@/components/entries/entries-table";
import { forms, getEntriesForForm } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default async function EntriesPage(props: PageProps<"/entries">) {
  const searchParams = await props.searchParams;
  const formParam = Array.isArray(searchParams.form)
    ? searchParams.form[0]
    : searchParams.form;
  const activeForm =
    forms.find((f) => f.formId === formParam) ?? forms[0];

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
        <Button asChild className="rounded-full">
          <Link href={`/voice/new?form=${activeForm.formId}`}>
            <Plus className="size-4" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Form tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        {forms.map((form) => {
          const isActive = form.id === activeForm.id;
          return (
            <Link
              key={form.id}
              href={`/entries?form=${form.formId}`}
              className={cn(
                "relative -mb-px flex items-center pb-3 text-sm font-medium transition-colors",
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

      <EntriesTable form={activeForm} entries={getEntriesForForm(activeForm.id)} />
    </div>
  );
}
