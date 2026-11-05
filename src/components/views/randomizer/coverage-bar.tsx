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

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json.

type Half = "fast" | "slow" | "center";

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

    // Faixa é simétrica em torno do centro (no log), em todos os modos:
    // a média geométrica dos extremos é o centro do cenário.
    const centerCm = Math.sqrt(lower * upper);
    const anchorK = latticeIndex(centerCm);

    const [lo, hi] = gridBounds(lower, upper);
    const countMap = new Map<number, number>();

    for (const session of relevantSessions) {
      if (session.sens > 0) {
        const k = latticeIndex(session.sens);
        countMap.set(k, (countMap.get(k) ?? 0) + 1);
      }
    }

    const items: Array<{ k: number; cm: number; count: number; half: Half; isAnchor: boolean }> = [];
    for (let k = lo; k <= hi; k++) {
      const cm = latticeCm(k);
      // cm/360 menor = sens mais alta = metade rápida.
      const isAnchor = k === anchorK;
      items.push({
        k,
        cm,
        count: countMap.get(k) ?? 0,
        half: isAnchor ? "center" : cm < centerCm ? "fast" : "slow",
        isAnchor,
      });
    }

    const zeroCountPoints = items.filter((i) => i.count === 0).length;
    const coveredCount = items.length - zeroCountPoints;
    const coveragePct = items.length > 0 ? Math.round((coveredCount / items.length) * 100) : 0;

    return {
      items,
      totalRuns: relevantSessions.length,
      zeroCountPoints,
      coveragePct,
    };
  }, [relevantSessions, minCm, maxCm]);

  if (coverageData.items.length === 0) {
    return null;
  }

  const isFull = coverageData.zeroCountPoints === 0 && coverageData.items.length > 0;

  return (
    <div className={cn("liquid-well p-3.5 rounded-tile space-y-2.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-text-secondary">
          <span>{t("randomizer.coverageTitle")}</span>
          <span className="text-[11px] text-text-faint font-mono tabular">
            ({coverageData.items.length} {t("randomizer.gridPoints").toLowerCase()})
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular">
          {isFull ? (
            <span className="text-emerald font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
              {t("randomizer.coverageFull")}
            </span>
          ) : (
            <span className="text-amber font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" />
              {coverageData.zeroCountPoints}{" "}
              {coverageData.zeroCountPoints === 1
                ? t("randomizer.coverageNoRunsOne")
                : t("randomizer.coverageNoRunsMany")}{" "}
              ({coverageData.coveragePct}%)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-3 text-[11px] text-text-faint">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-score-edge bg-score-soft" />
          {t("randomizer.coverageFastHalf")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-emerald-edge bg-emerald-soft" />
          {t("randomizer.coverageSlowHalf")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-text-main" />
          {t("randomizer.coverageAnchor")}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
        {coverageData.items.map((item) => {
          const isZero = item.count === 0;
          const runsLabel = item.count === 1 ? t("randomizer.coverageRunOne") : t("randomizer.coverageRunMany");
          return (
            <div
              key={item.k}
              className={cn(
                "p-2 rounded-control border text-center transition-all duration-150 hover:-translate-y-[1px]",
                isZero
                  ? "bg-amber-soft/50 border-amber-edge text-amber"
                  : item.half === "fast"
                    ? "bg-score-soft/40 border-score-edge text-text-main hover:border-score-edge"
                    : item.half === "slow"
                      ? "bg-emerald-soft/40 border-emerald-edge text-text-main hover:border-emerald-edge"
                      : "liquid-pill border-edge text-text-main hover:border-edge-strong",
                item.isAnchor && "ring-2 ring-text-main"
              )}
              title={`${item.cm.toFixed(1)} cm: ${item.count} ${runsLabel}${item.isAnchor ? ` (${t("randomizer.coverageAnchor")})` : ""}`}
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
                      : item.half === "slow"
                        ? "text-emerald bg-emerald-soft"
                        : "text-score bg-score-soft"
                  )}
                >
                  {item.count} {runsLabel}
                </span>
              </div>
              {item.isAnchor && (
                <div className="text-[9px] uppercase tracking-wide text-text-secondary mt-0.5">
                  {t("randomizer.coverageAnchor")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
