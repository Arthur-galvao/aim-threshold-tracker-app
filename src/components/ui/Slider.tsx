import * as React from "react";
import { Slider as BaseSlider } from "@base-ui/react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number | number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      className,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    return (
      <BaseSlider.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(val) => onValueChange?.(val)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "relative flex items-center select-none touch-none w-full py-2",
          disabled && "opacity-40 pointer-events-none",
          className
        )}
        {...props}
      >
        <BaseSlider.Control className="relative flex items-center w-full h-4 cursor-pointer">
          <BaseSlider.Track className="relative h-1.5 w-full grow rounded-full bg-surface-subtle border border-edge overflow-hidden">
            <BaseSlider.Indicator className="absolute h-full bg-score rounded-full" />
          </BaseSlider.Track>
          <BaseSlider.Thumb
            className="block w-4 h-4 rounded-full bg-text-main border-2 border-score shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score transition-transform hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing"
            aria-label={ariaLabel}
          />
        </BaseSlider.Control>
      </BaseSlider.Root>
    );
  }
);
Slider.displayName = "Slider";

export const SliderRoot = BaseSlider.Root;
export const SliderControl = BaseSlider.Control;
export const SliderTrack = BaseSlider.Track;
export const SliderIndicator = BaseSlider.Indicator;
export const SliderThumb = BaseSlider.Thumb;
