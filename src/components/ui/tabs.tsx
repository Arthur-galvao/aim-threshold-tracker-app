import React from "react";
import { Tabs as BaseTabs } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const Tabs = BaseTabs.Root;

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseTabs.List>
>(({ className, ...props }, ref) => (
  <BaseTabs.List
    ref={ref}
    className={cn(
      "glass-inset p-1 inline-flex items-center gap-1 rounded-control select-none",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTab = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Tab>
>(({ className, ...props }, ref) => (
  <BaseTabs.Tab
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center gap-1.5 h-8 px-3 text-sm font-medium rounded-[10px] cursor-pointer transition-colors focus-visible:outline-none select-none text-text-secondary hover:text-text-main data-[active]:text-text-main data-[active]:font-semibold data-[active]:glass-control data-[active]:shadow-1 disabled:opacity-40 disabled:pointer-events-none",
      className
    )}
    {...props}
  />
));
TabsTab.displayName = "TabsTab";

export const TabsPanel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Panel>
>(({ className, ...props }, ref) => (
  <BaseTabs.Panel
    ref={ref}
    className={cn("mt-3 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsPanel.displayName = "TabsPanel";
