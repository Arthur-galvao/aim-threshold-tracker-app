import React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
  badge?: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: "pills" | "underline";
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
  variant = "pills",
}: SegmentedProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    left: number;
    width: number;
  } | null>(null);

  React.useEffect(() => {
    const updateIndicator = () => {
      if (!containerRef.current) return;
      const activeEl = containerRef.current.querySelector<HTMLButtonElement>(
        '[aria-selected="true"]'
      );
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const ro = new ResizeObserver(updateIndicator);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [value, options]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % options.length;
      if (!options[nextIndex].disabled) onChange(options[nextIndex].value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + options.length) % options.length;
      if (!options[prevIndex].disabled) onChange(options[prevIndex].value);
    }
  };

  if (variant === "underline") {
    return (
      <div
        ref={containerRef}
        role="tablist"
        className={cn(
          "relative inline-flex items-center gap-5 sm:gap-7 select-none pb-0.5",
          className
        )}
      >
        {indicatorStyle && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 bg-score rounded-full pointer-events-none transition-[left,width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}
        {options.map((opt, idx) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={opt.disabled}
              title={opt.tooltip}
              onClick={() => !opt.disabled && onChange(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={cn(
                "relative z-10 flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score focus-visible:ring-offset-1 rounded-sm",
                opt.disabled
                  ? "opacity-40 cursor-not-allowed text-text-faint"
                  : isActive
                  ? "text-text-main"
                  : "text-text-secondary hover:text-text-main"
              )}
            >
              {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.badge && <span className="ml-0.5">{opt.badge}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative inline-flex items-center p-1 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-edge)] rounded-[var(--r-control,14px)] select-none shadow-xs",
        className
      )}
    >
      {indicatorStyle && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-[calc(var(--r-control,14px)-4px)] bg-surface text-text-main border border-edge shadow-sm pointer-events-none transition-[left,width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      )}
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={opt.disabled}
            title={opt.tooltip}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[calc(var(--r-control,14px)-4px)] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-score focus-visible:ring-offset-1",
              opt.disabled
                ? "opacity-40 cursor-not-allowed text-text-faint"
                : isActive
                ? "text-text-main font-semibold"
                : "text-text-secondary hover:text-text-main"
            )}
          >
            {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.badge && <span className="ml-0.5">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
