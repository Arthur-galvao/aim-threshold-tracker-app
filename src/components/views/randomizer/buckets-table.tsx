import { useI18n, type Key } from "@/lib/i18n";
import type { BucketStat } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface BucketsTableProps {
  buckets: BucketStat[];
  globalMeanScore: number;
  scopeAllTasks: boolean;
  onApplySens: (sensCm: number) => Promise<void>;
  className?: string;
}

export function BucketsTable({
  buckets,
  globalMeanScore,
  scopeAllTasks,
  onApplySens,
  className,
}: BucketsTableProps) {
  const { t } = useI18n();

  const getConfidenceBadge = (confidence: BucketStat["confidenceLevel"]) => {
    const map: Record<BucketStat["confidenceLevel"], { variant: BadgeVariant; textKey: Key }> = {
      high: { variant: "emerald", textKey: "randomizer.confidenceHigh" },
      medium: { variant: "score", textKey: "randomizer.confidenceMedium" },
      low: { variant: "amber", textKey: "randomizer.confidenceLow" },
      insufficient: { variant: "neutral", textKey: "randomizer.confInsufficient" },
    };
    const c = map[confidence];
    return <Badge variant={c.variant}>{t(c.textKey)}</Badge>;
  };

  if (buckets.length === 0) return null;

  return (
    <div className={cn("glass p-5 rounded-tile space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("randomizer.bucketsTableTitle")}
          </h2>
          <p className="text-xs text-text-faint mt-0.5">
            {t("randomizer.bucketsTableSubtitle")}
          </p>
        </div>
        <span className="text-xs font-mono text-text-faint tabular">
          {t("randomizer.globalAverage")}: {globalMeanScore.toFixed(1)}
          {scopeAllTasks ? "%" : " pts"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-edge text-[11px] text-text-faint font-semibold uppercase tracking-wider">
              <th className="py-2 px-3">{t("randomizer.colRange")}</th>
              <th className="py-2 px-3">{t("randomizer.colRuns")}</th>
              <th className="py-2 px-3">{t("randomizer.colBayesScore")}</th>
              <th className="py-2 px-3">{t("randomizer.colRawAvg")}</th>
              <th className="py-2 px-3">{t("randomizer.colPeakScore")}</th>
              <th className="py-2 px-3">{t("randomizer.colConsistency")}</th>
              <th className="py-2 px-3">{t("randomizer.colConfidence")}</th>
              <th className="py-2 px-3 text-right">{t("randomizer.colAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {buckets.map((b) => (
              <tr key={b.sens} className="hover:bg-surface-subtle transition-colors">
                <td className="py-2.5 px-3 font-mono font-semibold text-text-main tabular">
                  {b.label}
                </td>
                <td className="py-2.5 px-3 font-mono text-text-secondary tabular">
                  {b.count}
                </td>
                <td className="py-2.5 px-3 font-mono text-emerald font-semibold tabular">
                  {b.weightedScore.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 font-mono text-text-secondary tabular">
                  {b.avgScore.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 font-mono text-text-secondary tabular">
                  {b.maxScore.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 font-mono text-score tabular">
                  {b.consistency !== null ? `${b.consistency.toFixed(1)}%` : "-"}
                </td>
                <td className="py-2.5 px-3">
                  {getConfidenceBadge(b.confidenceLevel)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onApplySens(b.sens)}
                  >
                    {t("randomizer.applySens")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
