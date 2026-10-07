import React from "react";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md" | "lg";
  variant?: "secondary" | "ghost" | "danger" | "primary";
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
    sm: "w-7 h-7 text-xs rounded-md",
    md: "w-8 h-8 text-sm rounded-lg",
    lg: "w-9 h-9 text-base rounded-lg",
  }[size];

  const variantClasses = {
    primary:
      "bg-primary text-primary-fg hover:opacity-90 active:scale-[0.985] shadow-sm disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    secondary:
      "bg-surface-subtle text-text-secondary hover:text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    danger:
      "bg-red-soft text-red border border-red-edge hover:bg-red/20 active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
  }[variant];

  return (
    <button
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-flex items-center justify-center cursor-pointer select-none shrink-0 ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
