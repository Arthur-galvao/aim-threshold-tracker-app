import * as React from "react";
import { ScrollArea as BaseScrollArea } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, ...props }, ref) => (
    <BaseScrollArea.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <BaseScrollArea.Viewport
        className={cn(
          "h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar focus:outline-none",
          viewportClassName
        )}
      >
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        orientation="vertical"
        className="flex select-none touch-none p-0.5 bg-transparent transition-colors duration-150 ease-out hover:bg-surface-hover/30 w-1.5"
      >
        <BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-edge-strong hover:bg-text-faint transition-colors" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
);
ScrollArea.displayName = "ScrollArea";

export const ScrollAreaRoot = BaseScrollArea.Root;
export const ScrollAreaViewport = BaseScrollArea.Viewport;
export const ScrollAreaContent = BaseScrollArea.Content;
export const ScrollAreaScrollbar = BaseScrollArea.Scrollbar;
export const ScrollAreaThumb = BaseScrollArea.Thumb;
export const ScrollAreaCorner = BaseScrollArea.Corner;
