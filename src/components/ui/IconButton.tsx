import React, { forwardRef } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  "aria-label": string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      disabled,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center shrink-0 select-none transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:outline-none";

    const variantStyles = {
      primary:
        "bg-score text-base font-semibold shadow-1 hover:brightness-110 active:scale-95 press",
      secondary: "glass-control text-text-main",
      ghost:
        "text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-95 press",
      danger:
        "bg-red-soft text-red border border-red-edge hover:bg-red/20 active:scale-95 press",
    };

    const sizeStyles = {
      sm: "h-8 w-8 min-h-[32px] min-w-[32px] rounded-control",
      md: "h-9 w-9 min-h-[36px] min-w-[36px] rounded-control",
      lg: "h-10 w-10 min-h-[40px] min-w-[40px] rounded-control",
    };

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <CircleNotch className="animate-spin" size={size === "sm" ? 14 : 16} />
        ) : (
          <span className="inline-flex shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
