"use client";

import { useState } from "react";
import { Loader2, RotateCw, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Icon-only variant for table rows — a plain send icon, not a refresh/
 * reload symbol, since this fires off an email rather than re-fetching or
 * regenerating anything. The action name only shows up on hover. */
export function ResendEmailIconButton({ entry }: { entry?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

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
            setState("sending");
            setTimeout(() => setState("sent"), 1200);
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
        {state === "sent" ? "Email resent" : state === "sending" ? "Resending…" : `Resend email${entry ? ` for ${entry}` : ""}`}
      </TooltipContent>
    </Tooltip>
  );
}

export function ResendEmailButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (state === "sent") {
    return (
      <Button size="sm" variant="secondary" disabled className="rounded-full text-xs">
        <CheckCircle2 className="size-3.5 text-success" />
        Resent
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="rounded-full text-xs"
      disabled={state === "sending"}
      onClick={() => {
        setState("sending");
        setTimeout(() => setState("sent"), 1200);
      }}
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
