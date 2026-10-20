import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center justify-center p-8 text-center min-h-[220px]",
        className
      )}
    >
      {icon && (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-control glass-inset text-score shadow-1">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-main">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-text-secondary leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
