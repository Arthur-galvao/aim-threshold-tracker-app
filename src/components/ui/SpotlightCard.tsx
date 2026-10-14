import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  isFeatured?: boolean;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(var(--score-rgb) / 0.12)",
  isFeatured = false,
  ...props
}: SpotlightCardProps) {
  const divRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--mouse-x", `${x}px`);
    el.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "group/spotlight relative overflow-hidden glass-panel transition-all duration-200 hover:border-[var(--glass-edge-strong)] hover:shadow-md",
        isFeatured && "border-score/40 shadow-score/5",
        className
      )}
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "50%",
          "--spotlight-color": spotlightColor,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* High-performance pure CSS Spotlight Layer (Zero React re-renders) */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
        style={{
          background: `radial-gradient(380px circle at var(--mouse-x) var(--mouse-y), var(--spotlight-color), transparent 70%)`,
        }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

export interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className,
  size = 120,
  duration = 12,
  delay = 0,
  colorFrom = "var(--score)",
  colorTo = "transparent",
}: BorderBeamProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]",
        "[mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        className
      )}
    >
      <div
        className="absolute aspect-square bg-gradient-to-l from-[var(--color-from)] to-[var(--color-to)] [animation:border-beam_12s_linear_infinite]"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            animationDuration: `${duration}s`,
            animationDelay: `-${delay}s`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
