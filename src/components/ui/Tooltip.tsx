import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 6,
  className,
}: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <BaseTooltip.Provider delay={200}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          render={(props) => (
            <span className="inline-flex cursor-default" {...props}>
              {children}
            </span>
          )}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
            <BaseTooltip.Popup
              className={cn(
                "z-50 px-2.5 py-1 text-[11px] font-mono tracking-tight text-text-main",
                "bg-[var(--glass-bg-elevated)] backdrop-blur-md border border-[var(--glass-edge)] rounded-lg shadow-sm select-none",
                "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "focus:outline-none pointer-events-none",
                className
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;
export const TooltipPositioner = BaseTooltip.Positioner;
export const TooltipPopup = BaseTooltip.Popup;
export const TooltipArrow = BaseTooltip.Arrow;
