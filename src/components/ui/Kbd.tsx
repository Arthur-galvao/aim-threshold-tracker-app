import React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border border-edge bg-surface-subtle text-text-secondary select-none tabular",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
