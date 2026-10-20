import React, { forwardRef } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium select-none transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:outline-none";

    const variantStyles = {
      primary:
        "bg-score text-base font-semibold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.48),0_4px_14px_-4px_rgba(88,196,255,0.45)] hover:brightness-105 active:scale-[0.96] press",
      secondary: "liquid-pill text-text-main",
      ghost:
        "text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-[0.96] press",
      danger:
        "bg-red-soft text-red border border-red-edge shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.18)] hover:brightness-110 active:scale-[0.96] press",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-control gap-1.5",
      md: "h-9 px-3.5 text-sm rounded-control gap-2",
      lg: "h-10 px-4 text-base rounded-control gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <CircleNotch className="animate-spin" size={size === "sm" ? 14 : 16} />
        ) : (
          icon && iconPosition === "left" && <span className="inline-flex shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === "right" && (
          <span className="inline-flex shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
