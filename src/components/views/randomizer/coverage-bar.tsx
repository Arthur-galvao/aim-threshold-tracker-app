import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { gridBounds, latticeCm, latticeIndex } from "@/lib/sens-lattice";
import type { RunDataPoint } from "@/lib/sens-analytics";
import { cn } from "@/lib/utils";

export interface CoverageBarProps {
  relevantSessions: RunDataPoint[];
  minCm?: number;
  maxCm?: number;
  className?: string;
}

export function CoverageBar({
  relevantSessions,
  minCm,
  maxCm,
  className,
}: CoverageBarProps) {
  const { t } = useI18n();

  const coverageData = useMemo(() => {
    let lower = minCm;
    let upper = maxCm;

    if (!lower || !upper || lower >= upper) {
      if (relevantSessions.length > 0) {
        const sensList = relevantSessions.map((s) => s.sens).filter((s) => s > 0);
        if (sensList.length > 0) {
          lower = Math.min(...sensList);
          upper = Math.max(...sensList);
        }
      }
    }

    if (!lower || !upper || lower >= upper) {
      lower = 28;
      upper = 55;
    }

    const [lo, hi] = gridBounds(lower, upper);
    const countMap = new Map<number, number>();

    for (const session of relevantSessions) {
      if (session.sens > 0) {
        const k = latticeIndex(session.sens);
        countMap.set(k, (countMap.get(k) ?? 0) + 1);
      }
    }

    const items: Array<{ k: number; cm: number; count: number }> = [];
    for (let k = lo; k <= hi; k++) {
      items.push({
        k,
        cm: latticeCm(k),
        count: countMap.get(k) ?? 0,
      });
    }

    const zeroCountPoints = items.filter((i) => i.count === 0).length;

    return {
      items,
      totalRuns: relevantSessions.length,
      zeroCountPoints,
    };
  }, [relevantSessions, minCm, maxCm]);

  if (coverageData.items.length === 0) {
    return null;
  }

  const isFull = coverageData.zeroCountPoints === 0 && coverageData.items.length > 0;

  return (
    <div className={cn("glass-inset p-3.5 rounded-tile space-y-2.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-text-secondary">
          <span>{t("randomizer.coverageTitle") || "Cobertura da Grade"}</span>
          <span className="text-[11px] text-text-faint font-mono tabular">
            ({coverageData.items.length} {t("randomizer.gridPoints")?.toLowerCase() || "pontos"})
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular">
          {isFull ? (
            <span className="text-emerald font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
              100% coberto
            </span>
          ) : (
            <span className="text-amber font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" />
              {coverageData.zeroCountPoints}{" "}
              {coverageData.zeroCountPoints === 1 ? "ponto sem runs" : "pontos sem runs"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
        {coverageData.items.map((item) => {
          const isZero = item.count === 0;
          return (
            <div
              key={item.k}
              className={cn(
                "p-2 rounded-control border text-center transition-all",
                isZero
                  ? "bg-amber-soft border-amber-edge text-amber"
                  : "glass-control border-edge text-text-main"
              )}
              title={`${item.cm.toFixed(1)} cm: ${item.count} run(s)`}
            >
              <div className="text-[11px] font-mono font-bold leading-tight tabular">
                {item.cm.toFixed(1)}
              </div>
              <div className="flex items-center justify-center mt-1">
                <span
                  className={cn(
                    "text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full tabular",
                    isZero
                      ? "text-amber bg-amber-soft"
                      : "text-score bg-score-soft"
                  )}
                >
                  {item.count} {item.count === 1 ? "run" : "runs"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
