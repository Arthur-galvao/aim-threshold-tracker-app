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
      "group relative inline-flex items-center justify-center font-medium select-none transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:outline-none overflow-hidden";

    const variantStyles = {
      primary:
        "bg-score text-base font-semibold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.48),0_4px_16px_-3px_rgb(var(--score-rgb)/0.45)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),0_6px_22px_-2px_rgb(var(--score-rgb)/0.65)] hover:brightness-105 press",
      secondary: "liquid-pill text-text-main press",
      ghost:
        "text-text-secondary hover:text-text-main hover:bg-surface-hover press",
      danger:
        "bg-red-soft text-red border border-red-edge shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.18)] hover:brightness-110 hover:shadow-[0_4px_16px_-4px_rgb(var(--red-rgb)/0.4)] press",
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
        {/* Subtle specular sheen sweep on primary button hover */}
        {variant === "primary" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
          />
        )}
        {loading ? (
          <CircleNotch className="animate-spin" size={size === "sm" ? 14 : 16} />
        ) : (
          icon &&
          iconPosition === "left" && (
            <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:scale-110">
              {icon}
            </span>
          )
        )}
        {children && <span className="relative z-10">{children}</span>}
        {!loading && icon && iconPosition === "right" && (
          <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
            {icon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
