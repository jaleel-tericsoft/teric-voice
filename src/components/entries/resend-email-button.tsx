"use client";

import { useState } from "react";
import { Loader2, RotateCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
