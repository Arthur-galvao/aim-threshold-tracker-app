import React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;
export const TooltipPortal = BaseTooltip.Portal;
export const TooltipPositioner = BaseTooltip.Positioner;

export const TooltipPopup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup>
>(({ className, ...props }, ref) => (
  <BaseTooltip.Popup
    ref={ref}
    className={cn(
      "glass-float z-50 px-2.5 py-1 text-xs text-text-main rounded-control shadow-float pointer-events-none animate-pop-in border border-glass-edge",
      className
    )}
    {...props}
  />
));
TooltipPopup.displayName = "TooltipPopup";

export interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 6,
  disabled = false,
}: SimpleTooltipProps) {
  if (disabled || !content) {
    return children;
  }

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
          <TooltipPopup>{content}</TooltipPopup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
