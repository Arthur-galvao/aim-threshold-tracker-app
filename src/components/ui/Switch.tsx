import React from "react";
import { Switch as BaseSwitch } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof BaseSwitch.Root> {}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <BaseSwitch.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 data-[checked]:bg-emerald data-[checked]:border data-[checked]:border-emerald-edge data-[unchecked]:liquid-well press",
        className
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-text-main shadow-[0_2px_5px_rgba(0,0,0,0.45),inset_0_1px_0.5px_rgba(255,255,255,0.8)] transition-transform duration-200 ease-out data-[checked]:translate-x-[20px] data-[unchecked]:translate-x-0" />
    </BaseSwitch.Root>
  )
);

Switch.displayName = "Switch";
