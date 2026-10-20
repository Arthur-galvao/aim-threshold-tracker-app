import React from "react";
import { Popover as BasePopover } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverPortal = BasePopover.Portal;
export const PopoverPositioner = BasePopover.Positioner;
export const PopoverClose = BasePopover.Close;
export const PopoverTitle = BasePopover.Title;
export const PopoverDescription = BasePopover.Description;

export const PopoverPopup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BasePopover.Popup>
>(({ className, ...props }, ref) => (
  <BasePopover.Popup
    ref={ref}
    className={cn(
      "liquid-float top-layer-popup z-50 p-3.5 shadow-float text-sm text-text-main focus:outline-none",
      className
    )}
    {...props}
  />
));
PopoverPopup.displayName = "PopoverPopup";
