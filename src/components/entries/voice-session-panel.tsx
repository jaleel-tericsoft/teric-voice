"use client";

import { useState } from "react";
import { ChevronDown, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceSession } from "@/types";

export function VoiceSessionPanel({ session }: { session: VoiceSession }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground">
            <Mic className="size-3.5" />
          </span>
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">
              Voice Session
            </div>
            <div className="text-xs text-muted-foreground">
              {session.messages.length} messages
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border/60 px-5 py-4">
          {session.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "assistant" ? "justify-start" : "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  m.role === "assistant"
                    ? "bg-muted text-foreground"
                    : "bg-foreground text-background"
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
