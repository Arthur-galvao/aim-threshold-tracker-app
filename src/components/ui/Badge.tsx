import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "amber" | "emerald" | "red";
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
    sm: "text-[11px] px-1.5 py-0.5 rounded font-mono",
    md: "text-xs px-2 py-0.5 rounded-md font-medium",
  }[size];

  const variantClasses = {
    neutral: "bg-surface-subtle text-text-secondary border border-edge",
    accent: "bg-accent-soft text-accent border border-accent-edge",
    amber: "bg-amber-soft text-amber border border-amber-edge",
    emerald: "bg-emerald-soft text-emerald border border-emerald-edge",
    red: "bg-red-soft text-red border border-red-edge",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 leading-none select-none tracking-tight ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
