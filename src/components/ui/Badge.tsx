import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "score" | "emerald" | "amber" | "red";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    neutral:
      "bg-surface-subtle text-text-secondary border-edge backdrop-blur-md shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.16)]",
    score:
      "bg-score-soft text-score border-edge backdrop-blur-md shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.22)]",
    emerald:
      "bg-emerald-soft text-emerald border-emerald-edge backdrop-blur-md shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.22)]",
    amber:
      "bg-amber-soft text-amber border-amber-edge backdrop-blur-md shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.22)]",
    red:
      "bg-red-soft text-red border-red-edge backdrop-blur-md shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.22)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium border tabular select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
