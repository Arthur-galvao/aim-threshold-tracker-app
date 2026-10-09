import React from "react";

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
      <div role="tablist" className={`inline-flex items-center gap-5 sm:gap-7 select-none ${className}`}>
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
              className={`relative flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                opt.disabled
                  ? "opacity-40 cursor-not-allowed text-text-faint"
                  : isActive
                  ? "text-text-main after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-text-main"
                  : "text-text-secondary hover:text-text-main"
              }`}
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
      role="tablist"
      className={`inline-flex items-center p-1 bg-surface-subtle border border-edge rounded-lg select-none ${className}`}
    >
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
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer ${
              opt.disabled
                ? "opacity-45 cursor-not-allowed text-text-faint hover:bg-transparent"
                : isActive
                ? "bg-surface text-text-main font-semibold shadow-sm border border-edge"
                : "text-text-secondary hover:text-text-main hover:bg-surface-hover/50"
            }`}
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
