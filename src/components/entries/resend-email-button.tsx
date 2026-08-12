"use client";

import { useState } from "react";
import { Loader2, RotateCw, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useResendEmail } from "@/lib/use-resend-email";
import type { Entry } from "@/types";

/** Shown inside the resend popover whenever the entry has no email on
 * file yet — the form's contact_email question is optional, so this is a
 * real, expected case, not an error state. Collects one on the spot and
 * sends immediately, mirroring what the voice widget's
 * record_customer_email + resend_pdf_email tools do together. */
function MissingEmailForm({ onSend }: { onSend: (email: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSend(value.trim());
      }}
    >
      <p className="text-xs text-muted-foreground">
        No email on file for this customer yet — add one to send the PDF.
      </p>
      <Input
        type="email"
        required
        autoFocus
        placeholder="customer@example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-xl text-sm"
      />
      <Button type="submit" size="sm" className="rounded-full text-xs">
        <Send className="size-3.5" />
        Send
      </Button>
    </form>
  );
}

/** Icon-only variant for table rows — a plain send icon, not a refresh/
 * reload symbol, since this fires off an email rather than re-fetching or
 * regenerating anything. The action name only shows up on hover. */
export function ResendEmailIconButton({ entry }: { entry: Entry }) {
  const { recipient, state, send } = useResendEmail(entry);
  const [open, setOpen] = useState(false);

  if (!recipient) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Add customer email to send"
                className="rounded-full text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Send className="size-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add email to send</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-64" onClick={(e) => e.stopPropagation()}>
          <MissingEmailForm
            onSend={(email) => {
              send(email);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={state === "sent" ? "Email resent" : "Resend email"}
          className="rounded-full text-muted-foreground"
          disabled={state !== "idle"}
          onClick={(e) => {
            e.stopPropagation();
            send();
          }}
        >
          {state === "sending" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : state === "sent" ? (
            <CheckCircle2 className="size-3.5 text-success" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {state === "sent"
          ? "Email resent"
          : state === "sending"
            ? "Resending…"
            : `Resend email to ${recipient}`}
      </TooltipContent>
    </Tooltip>
  );
}

export function ResendEmailButton({ entry }: { entry: Entry }) {
  const { recipient, state, send } = useResendEmail(entry);

  if (state === "sent") {
    return (
      <Button size="sm" variant="secondary" disabled className="rounded-full text-xs">
        <CheckCircle2 className="size-3.5 text-success" />
        Resent
      </Button>
    );
  }

  if (!recipient) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="secondary" className="rounded-full text-xs">
            <Send className="size-3.5" />
            Add Email &amp; Send
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <MissingEmailForm onSend={(email) => send(email)} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="rounded-full text-xs"
      disabled={state === "sending"}
      onClick={() => send()}
    >
      {state === "sending" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RotateCw className="size-3.5" />
      )}
      {state === "sending" ? "Resending…" : "Resend Email"}
    </Button>
  );
}
