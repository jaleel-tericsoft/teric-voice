"use client";

import { cn } from "@/lib/utils";

export type OrbState = "idle" | "speaking" | "listening" | "thinking";

const barHeights = [0.4, 0.75, 1, 0.55, 0.85, 0.35, 0.65];

export function VoiceOrb({ state, size = 208 }: { state: OrbState; size?: number }) {
  const active = state === "speaking" || state === "listening";

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Expanding pulse rings */}
      {active && (
        <>
          <span
            className={cn(
              "absolute inset-0 rounded-full border animate-orb-pulse-ring",
              state === "speaking" ? "border-white/40" : "border-lime/50"
            )}
          />
          <span
            className={cn(
              "absolute inset-0 rounded-full border animate-orb-pulse-ring [animation-delay:0.6s]",
              state === "speaking" ? "border-white/30" : "border-lime/35"
            )}
          />
        </>
      )}

      {/* Ambient glow */}
      <div
        className={cn(
          "absolute inset-3 rounded-full blur-2xl transition-colors duration-500",
          state === "speaking" && "bg-white/25",
          state === "listening" && "bg-lime/25",
          state === "thinking" && "bg-white/10",
          state === "idle" && "bg-white/10"
        )}
      />

      {/* Rotating textured ring */}
      <div
        className={cn(
          "absolute inset-2 rounded-full opacity-40",
          state === "thinking"
            ? "animate-orb-spin-slow border-2 border-dashed border-white/30"
            : "animate-orb-spin-slow-rev"
        )}
        style={{
          background:
            state === "thinking"
              ? undefined
              : "conic-gradient(from 90deg, transparent 0%, rgba(255,255,255,0.18) 20%, transparent 40%, transparent 60%, rgba(255,255,255,0.12) 80%, transparent 100%)",
        }}
      />

      {/* Core sphere */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full border border-white/25 shadow-[inset_0_0_40px_rgba(255,255,255,0.08)] transition-[filter] duration-300",
          state === "speaking" && "animate-orb-speak",
          state === "idle" && "animate-orb-breathe",
          state === "listening" && "animate-orb-breathe",
          state === "thinking" && "opacity-70"
        )}
        style={{
          width: size * 0.74,
          height: size * 0.74,
          background:
            "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 38%, rgba(0,0,0,0.35) 75%)",
        }}
      >
        {/* Listening waveform */}
        {state === "listening" && (
          <div className="flex items-end gap-[3px]" style={{ height: size * 0.22 }}>
            {barHeights.map((h, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-lime animate-bar-bounce"
                style={{
                  height: "100%",
                  transform: `scaleY(${h})`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
