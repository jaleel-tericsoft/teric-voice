"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, ArrowRight } from "lucide-react";
import { useFormsStore } from "@/lib/forms-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** "Start Voice Form" trigger shared by the sidebar and the dashboard hero.
 * Always asks which form to fill first — even with a single form today —
 * so the flow already works once more forms get published. */
export function StartVoiceFormButton({ className }: { className?: string }) {
  const { forms } = useFormsStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const activeForms = forms.filter((f) => f.status === "active");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Mic className="size-4" strokeWidth={2.5} />
        Start Voice Form
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Which form would you like to fill?</DialogTitle>
            <DialogDescription>
              Pick a form to start a hands-free voice entry.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            {activeForms.map((form) => (
              <button
                key={form.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/voice/new?form=${form.formId}`);
                }}
                className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-teal hover:bg-muted"
              >
                {form.name}
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
            {activeForms.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active forms yet. Publish a form from Form Builder first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
