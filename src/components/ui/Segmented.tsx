import React, { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  id?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  id,
}: SegmentedProps<T>) {
  const generatedId = useId();
  const componentId = id || generatedId;

  const sizeStyles = {
    sm: "h-7 text-xs px-2.5",
    md: "h-8 text-sm px-3",
  };

  return (
    <div
      role="radiogroup"
      className={cn(
        "liquid-well p-1 inline-flex items-center gap-1 rounded-control select-none",
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group relative z-10 inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-200 rounded-[10px] cursor-pointer focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none active:scale-95",
              sizeStyles[size],
              isSelected
                ? "text-text-main font-semibold"
                : "text-text-secondary hover:text-text-main"
            )}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-pill-${componentId}`}
                transition={{
                  type: "spring",
                  stiffness: 460,
                  damping: 30,
                  mass: 0.75,
                }}
                className="absolute inset-0 z-[-1] liquid-pill rounded-[10px]"
              />
            )}
            {opt.icon && (
              <span
                className={cn(
                  "inline-flex shrink-0 transition-transform duration-200",
                  isSelected
                    ? "text-score scale-105"
                    : "group-hover:scale-110 group-hover:text-text-main"
                )}
              >
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
