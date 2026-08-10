"use client";

import { useState } from "react";
import { Columns3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import type { EntryColumnDef } from "@/lib/form-utils";

/** "Columns" button beside New Entry — opens a drawer to choose which
 * optional columns the entries table shows. Entry ID, the primary
 * identifying column (e.g. Number Plate), and Actions are always on, so
 * they're listed checked and disabled rather than removable — a row with
 * no way to identify or act on it isn't useful. Selections are staged in
 * the drawer and only take effect on Apply, then persist (see
 * useColumnVisibility) so they stay applied on the next visit too. */
export function ColumnsDrawer({
  columns,
  visible,
  onApply,
}: {
  columns: EntryColumnDef[];
  visible: Record<string, boolean>;
  onApply: (next: Record<string, boolean>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>(visible);

  const activeCount = columns.filter((c) => !c.mandatory && visible[c.key] !== false).length;
  const optionalCount = columns.filter((c) => !c.mandatory).length;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(visible);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <Columns3 className="size-4" />
          Columns
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Table columns</SheetTitle>
          <SheetDescription>
            Choose which columns show in the entries table ({activeCount}/{optionalCount}{" "}
            optional columns on).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-1 overflow-y-auto px-4">
          {columns.map((col) => {
            const checked = col.mandatory || draft[col.key] !== false;
            return (
              <label
                key={col.key}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  disabled={col.mandatory}
                  onCheckedChange={(next) => {
                    setDraft((prev) => ({ ...prev, [col.key]: next === true }));
                  }}
                />
                <span className="flex-1">{col.label}</span>
                {col.mandatory && (
                  <Lock className="size-3 text-muted-foreground/50" aria-label="Always shown" />
                )}
              </label>
            );
          })}
        </div>

        <SheetFooter className="flex-row justify-between">
          <Button
            variant="ghost"
            onClick={() => setDraft(Object.fromEntries(columns.map((c) => [c.key, true])))}
          >
            Reset to default
          </Button>
          <SheetClose asChild>
            <Button
              className="rounded-full"
              onClick={() => {
                onApply(draft);
              }}
            >
              Apply
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
