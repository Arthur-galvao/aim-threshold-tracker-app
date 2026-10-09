import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, className, children, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex items-center justify-center rounded-lg bg-surface-subtle p-1 border border-edge text-text-secondary select-none",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  layoutId?: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, layoutId = "activeTabIndicator", className, children, disabled, ...props }, ref) => {
    const { value: activeValue, onValueChange } = useTabs();
    const isSelected = activeValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        disabled={disabled}
        onClick={() => !disabled && onValueChange(value)}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer z-10",
          isSelected ? "text-text-main font-semibold" : "text-text-secondary hover:text-text-main",
          className
        )}
        {...props}
      >
        {isSelected && (
          <motion.div
            layoutId={layoutId}
            className="absolute inset-0 rounded-md bg-surface border border-edge shadow-sm -z-10"
            transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
          />
        )}
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: activeValue } = useTabs();
    if (activeValue !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={cn("mt-4 focus-visible:outline-none", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
