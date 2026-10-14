import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      disabled = false,
      className,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    return (
      <BaseSwitch.Root
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={(isChecked) => onCheckedChange?.(isChecked)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-edge bg-surface-subtle p-0.5 transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 data-[checked]:bg-score data-[checked]:border-score",
          className
        )}
        {...props}
      >
        <BaseSwitch.Thumb
          className="pointer-events-none block h-3.5 w-3.5 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.2)] border border-[var(--glass-edge)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] data-[checked]:translate-x-4"
        />
      </BaseSwitch.Root>
    );
  }
);
Switch.displayName = "Switch";

export const SwitchRoot = BaseSwitch.Root;
export const SwitchThumb = BaseSwitch.Thumb;
