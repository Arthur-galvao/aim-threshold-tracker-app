import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  return React.useContext(TabsContext);
}

export interface TabsProps extends React.ComponentPropsWithoutRef<typeof BaseTabs.Root> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? "");
    const activeValue = value !== undefined ? value : internalValue;

    const handleValueChange = (val: string) => {
      if (value === undefined) {
        setInternalValue(val);
      }
      onValueChange?.(val);
    };

    return (
      <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
        <BaseTabs.Root
          ref={ref}
          value={activeValue}
          onValueChange={(nextVal) => handleValueChange(String(nextVal))}
          className={cn("w-full", className)}
          {...props}
        >
          {children}
        </BaseTabs.Root>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof BaseTabs.List> {
  className?: string;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <BaseTabs.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-surface-subtle p-1 border border-edge text-text-secondary select-none font-sans",
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof BaseTabs.Tab> {
  value: string;
  layoutId?: string;
  className?: string;
  disabled?: boolean;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, layoutId = "activeTabIndicator", className, children, disabled, ...props }, ref) => {
    const context = useTabsContext();
    const isSelected = context?.value === value;

    return (
      <BaseTabs.Tab
        ref={ref}
        value={value}
        disabled={disabled}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 cursor-pointer z-10 select-none",
          isSelected ? "text-text-main font-semibold" : "text-text-faint hover:text-text-main",
          className
        )}
        {...props}
      >
        {isSelected && (
          <motion.div
            layoutId={layoutId}
            className="absolute inset-0 rounded-[inherit] bg-surface border border-edge shadow-xs -z-10"
            transition={{ type: "spring", bounce: 0.15, duration: 0.22 }}
          />
        )}
        {children}
      </BaseTabs.Tab>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.ComponentPropsWithoutRef<typeof BaseTabs.Panel> {
  value: string;
  className?: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => (
    <BaseTabs.Panel
      ref={ref}
      value={value}
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </BaseTabs.Panel>
  )
);
TabsContent.displayName = "TabsContent";
