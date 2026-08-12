"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdleLogout } from "@/lib/use-idle-logout";

/** Mounted once in the (app) layout. Renders nothing for almost the entire
 * idle window — only appears in the final ~30 seconds as a small "still
 * there?" banner, per the agreed UX (a permanently-visible countdown would
 * be more distracting than useful on a glasses-style display). */
export function IdleLogoutBanner() {
  const { warningSecondsLeft, stayLoggedIn } = useIdleLogout();

  if (warningSecondsLeft === null) return null;

  const minutes = Math.floor(warningSecondsLeft / 60);
  const seconds = warningSecondsLeft % 60;
  const label = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2.5 shadow-lg">
      <Clock className="size-4 shrink-0 text-amber-500" strokeWidth={2} />
      <span className="text-sm text-foreground">
        Logging out in <span className="font-semibold tabular-nums">{label}</span> — still there?
      </span>
      <Button size="sm" className="rounded-full" onClick={stayLoggedIn}>
        Stay logged in
      </Button>
    </div>
  );
}
