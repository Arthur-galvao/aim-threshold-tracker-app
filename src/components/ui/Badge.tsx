import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "amber" | "emerald" | "red" | "score";
  size?: "sm" | "md";
}

export function Badge({
  variant = "neutral",
  size = "md",
  children,
  className = "",
  ...props
}: BadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5 rounded-full font-mono tracking-tight",
    md: "text-xs px-2.5 py-0.5 rounded-full font-medium tracking-tight",
  }[size];

  const variantClasses = {
    neutral: "bg-surface-subtle text-text-secondary border border-edge",
    accent: "bg-accent-soft text-accent border border-accent-edge",
    score: "bg-score-soft text-score border border-score/25",
    amber: "bg-amber-soft text-amber border border-amber-edge",
    emerald: "bg-emerald-soft text-emerald border border-emerald-edge",
    red: "bg-red-soft text-red border border-red-edge",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 leading-none select-none",
        sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
