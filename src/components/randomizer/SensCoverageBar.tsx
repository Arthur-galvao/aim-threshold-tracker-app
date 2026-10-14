import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { gridBounds, latticeCm, latticeIndex } from "@/lib/sens-lattice";
import type { RunDataPoint } from "@/lib/sens-analytics";

interface SensCoverageBarProps {
  relevantSessions: RunDataPoint[];
  minCm?: number;
  maxCm?: number;
}

export function SensCoverageBar({
  relevantSessions,
  minCm,
  maxCm,
}: SensCoverageBarProps) {
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

    const maxCount = Math.max(1, ...items.map((i) => i.count));
    const zeroCountPoints = items.filter((i) => i.count === 0).length;

    return {
      items,
      maxCount,
      totalRuns: relevantSessions.length,
      zeroCountPoints,
    };
  }, [relevantSessions, minCm, maxCm]);

  if (coverageData.items.length === 0) {
    return null;
  }

  return (
    <div className="p-3.5 rounded-2xl bg-surface-subtle/50 border border-edge space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-text-secondary uppercase tracking-wider">
          <span>{t("randomizer.coverageTitle") ?? "Cobertura da Grade"}</span>
          <span className="text-[10px] text-text-faint font-mono font-normal tabular-nums">
            ({coverageData.items.length} {t("randomizer.gridPoints")?.toLowerCase() ?? "pontos"})
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
          {coverageData.zeroCountPoints > 0 ? (
            <span className="text-amber font-medium">
              {coverageData.zeroCountPoints} {coverageData.zeroCountPoints === 1 ? "ponto sem runs" : "pontos sem runs"}
            </span>
          ) : (
            <span className="text-emerald font-medium">
              100% coberto
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 pt-1">
        {coverageData.items.map((item) => {
          const isZero = item.count === 0;
          return (
            <div
              key={item.k}
              className={`p-1.5 rounded-lg border text-center transition-all ${
                isZero
                  ? "bg-amber-soft/50 border-amber-edge text-amber"
                  : "bg-surface border-edge text-text-main shadow-xs"
              }`}
              title={`${item.cm.toFixed(1)} cm: ${item.count} run(s)`}
            >
              <div className="text-[10px] font-mono font-bold leading-tight tabular-nums">
                {item.cm.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span
                  className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded tabular-nums ${
                    isZero
                      ? "text-amber bg-amber-soft"
                      : "text-score bg-score-soft"
                  }`}
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
