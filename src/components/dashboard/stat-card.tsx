import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "lime" | "warn";
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            tone === "lime" && "bg-lime text-lime-foreground",
            tone === "warn" && "bg-warning/15 text-warning",
            tone === "default" && "bg-muted text-foreground"
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        {hint && (
          <span className="text-xs font-medium text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
