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
      <div className="flex w-fit items-center gap-1 rounded-full bg-muted p-1">
        {forms.map((form) => {
          const isActive = form.id === activeForm.id;
          return (
            <Link
              key={form.id}
              href={`/entries?form=${form.formId}`}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {form.name}
            </Link>
          );
        })}
      </div>

      <EntriesTable form={activeForm} entries={getEntriesForForm(activeForm.id)} />
    </div>
  );
}
