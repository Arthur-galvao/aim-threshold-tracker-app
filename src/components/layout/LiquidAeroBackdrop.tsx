/**
 * LiquidAeroBackdrop: static, theme-aware stage behind the glass.
 * Orbs derive from the active theme accent (--score) so every theme/mode stays coherent.
 * Zero continuous GPU work (no animation loops).
 */
export function LiquidAeroBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
      style={{ backgroundColor: "var(--base)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 14% 8%, color-mix(in oklab, var(--score) 26%, transparent), transparent 70%),
            radial-gradient(ellipse 55% 50% at 88% 14%, color-mix(in oklab, var(--emerald) 16%, transparent), transparent 72%),
            radial-gradient(ellipse 70% 55% at 50% 100%, color-mix(in oklab, var(--score) 14%, transparent), transparent 75%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
        }}
      />
    </div>
  );
}
