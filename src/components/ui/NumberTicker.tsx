import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface NumberTickerProps {
  value: number;
  decimalPlaces?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function NumberTicker({
  value,
  decimalPlaces = 0,
  duration = 0.55,
  prefix = "",
  suffix = "",
  className,
}: NumberTickerProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeValue);
  const [isTicking, setIsTicking] = useState(false);
  const startValueRef = useRef<number>(safeValue);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = Number.isFinite(displayValue) ? displayValue : safeValue;
    const endVal = safeValue;
    if (startVal === endVal) return;

    startValueRef.current = startVal;
    startTimeRef.current = null;
    setIsTicking(true);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      // Exponential ease-out: 1 - Math.pow(2, -10 * progress)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        setIsTicking(false);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [safeValue, duration]);

  const safeDisplay = Number.isFinite(displayValue) ? displayValue : safeValue;
  const formatted = safeDisplay.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return (
    <span
      className={cn(
        "font-mono tabular select-none inline-block transition-transform duration-200",
        isTicking && "scale-[1.03] brightness-110",
        className
      )}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
