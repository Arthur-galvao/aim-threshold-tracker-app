import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar",
          viewportClassName
        )}
      >
        {children}
      </div>
    </div>
  )
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
