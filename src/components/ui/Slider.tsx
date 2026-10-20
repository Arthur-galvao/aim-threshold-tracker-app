import React from "react";
import { Slider as BaseSlider } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const SliderRoot = BaseSlider.Root;
export const SliderControl = BaseSlider.Control;
export const SliderTrack = BaseSlider.Track;
export const SliderIndicator = BaseSlider.Indicator;
export const SliderThumb = BaseSlider.Thumb;

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof BaseSlider.Root> {
  thumbLabel?: string;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, thumbLabel, ...props }, ref) => (
    <BaseSlider.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
      {...props}
    >
      <BaseSlider.Control className="relative flex w-full items-center">
        <BaseSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-subtle border border-edge">
          <BaseSlider.Indicator className="h-full bg-score transition-all" />
        </BaseSlider.Track>
        <BaseSlider.Thumb
          aria-label={thumbLabel || "Slider"}
          className="block h-4 w-4 rounded-full border border-glass-edge bg-text-main shadow-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score press cursor-grab active:cursor-grabbing"
        />
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
);

Slider.displayName = "Slider";
