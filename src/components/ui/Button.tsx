import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
    md: "h-8 px-3 text-xs gap-2 rounded-lg font-medium",
    lg: "h-9 px-4 text-sm gap-2 rounded-lg font-semibold",
  }[size];

  const variantClasses = {
    primary:
      "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.985] shadow-sm disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    secondary:
      "bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-main hover:bg-surface-subtle active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
    danger:
      "bg-red-soft text-red border border-red-edge hover:bg-red/20 active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150",
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
