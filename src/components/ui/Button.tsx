import * as React from "react";
import { Button as BaseButton } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "frosted";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-7 px-2.5 text-xs gap-1.5 rounded-[10px]",
      md: "h-8 px-3.5 text-xs gap-2 rounded-xl font-medium",
      lg: "h-9 px-4 text-sm gap-2 rounded-xl font-semibold",
    }[size];

    const variantClasses = {
      primary:
        "bg-score text-primary-foreground font-semibold hover:brightness-105 active:scale-[0.96] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
      secondary:
        "bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
      frosted:
        "bg-[var(--glass-bg-elevated)] backdrop-blur-md text-text-main border border-[var(--glass-edge)] hover:bg-[var(--surface-hover)] hover:border-[var(--glass-edge-strong)] active:scale-[0.96] shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
      ghost:
        "bg-transparent text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
      danger:
        "bg-red-soft text-red border border-red-edge hover:bg-red/20 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    }[variant];

    return (
      <BaseButton
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0 flex items-center">{icon}</span>}
        {children}
      </BaseButton>
    );
  }
);
Button.displayName = "Button";

