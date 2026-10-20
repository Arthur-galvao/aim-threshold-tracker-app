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
    neutral: "bg-surface-subtle text-text-secondary border-edge",
    score: "bg-score-soft text-score border-edge",
    emerald: "bg-emerald-soft text-emerald border-emerald-edge",
    amber: "bg-amber-soft text-amber border-amber-edge",
    red: "bg-red-soft text-red border-red-edge",
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
