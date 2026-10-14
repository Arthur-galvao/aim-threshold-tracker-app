import React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md" | "lg";
  variant?: "secondary" | "ghost" | "danger" | "primary" | "frosted";
}

export function IconButton({
  "aria-label": ariaLabel,
  size = "md",
  variant = "secondary",
  children,
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: "w-7 h-7 text-xs rounded-[10px]",
    md: "w-8 h-8 text-sm rounded-xl",
    lg: "w-9 h-9 text-base rounded-xl",
  }[size];

  const variantClasses = {
    primary:
      "bg-score text-primary-foreground hover:brightness-105 active:scale-[0.95] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    secondary:
      "bg-surface-subtle text-text-secondary hover:text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    frosted:
      "bg-[var(--glass-bg-elevated)] backdrop-blur-md text-text-secondary hover:text-text-main border border-[var(--glass-edge)] hover:bg-[var(--surface-hover)] hover:border-[var(--glass-edge-strong)] active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    danger:
      "bg-red-soft text-red border border-red-edge hover:bg-red/20 active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
  }[variant];

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center cursor-pointer select-none shrink-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        sizeClasses,
        variantClasses,
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
