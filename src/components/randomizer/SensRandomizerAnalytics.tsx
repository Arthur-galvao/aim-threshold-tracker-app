import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type { SweetSpotAnalysis, RunDataPoint, BucketStat } from "@/lib/sens-analytics";

interface SensRandomizerAnalyticsProps {
  analysis: SweetSpotAnalysis | null;
  relevantSessions: RunDataPoint[];
  scopeAllTasks: boolean;
  onApplySens: (sensCm: number) => Promise<void>;
}

export function SensRandomizerAnalytics({
  analysis,
  relevantSessions,
  scopeAllTasks,
  onApplySens,
}: SensRandomizerAnalyticsProps) {
  const { t } = useI18n();

  const recentRuns = useMemo(() => {
    return [...relevantSessions].slice(-10).reverse();
  }, [relevantSessions]);

  const bestBucket = analysis?.bestBucket ?? null;

  const renderConfidenceBadge = (bucket: BucketStat) => {
    switch (bucket.confidenceLevel) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t("randomizer.confidenceHigh")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {t("randomizer.confidenceMedium")}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t("randomizer.confidenceLow")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle text-text-faint border border-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-text-faint" />
            {t("randomizer.confInsufficient")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Sweet Spot Recommendation Hero Card */}
      {analysis && bestBucket && (
        <div className="panel p-6 rounded-2xl border-edge-strong bg-surface/80 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-edge pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber">
                  {t("randomizer.sweetSpotTitle")}
                </span>
                {renderConfidenceBadge(bestBucket)}
                {analysis.isProvisional && (
                  <span className="text-[11px] font-medium text-amber/90 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {t("randomizer.badgeProvisional")}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {analysis.isProvisional
                  ? t("randomizer.sampleSizeExplanation", { n: analysis.minEligibleRuns })
                  : t("randomizer.sweetSpotSubtitle")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onApplySens((bestBucket.min + bestBucket.max) / 2)}
              className="minimal-btn px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 self-stretch sm:self-auto justify-center"
            >
              <span>{t("randomizer.applySensBtn")}</span>
              <span className="font-mono text-blue-200">
                {((bestBucket.min + bestBucket.max) / 2).toFixed(1)} cm
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint block">
                {t("randomizer.optimalRange")}
              </span>
              <span className="text-2xl font-mono font-bold text-text-main mt-1 block">
                {bestBucket.rangeLabel}
              </span>
              <span className="text-[10px] text-text-faint mt-0.5 block">
                {t("randomizer.midpoint")}: {((bestBucket.min + bestBucket.max) / 2).toFixed(1)} cm
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-edge">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint block">
                {scopeAllTasks ? t("randomizer.weightedNormScore") : t("randomizer.weightedScore")}
              </span>
              <span className="text-2xl font-mono font-bold text-emerald-400 mt-1 block">
                {bestBucket.weightedScore.toFixed(1)}
                {scopeAllTasks ? "%" : ""}
              </span>
              <span className="text-[10px] text-text-faint mt-0.5 block">
                {t("randomizer.rawAvg")}: {bestBucket.avgScore.toFixed(1)}
                {scopeAllTasks ? "%" : " pts"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-edge">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint block">
                {t("randomizer.consistencyScore")}
              </span>
              <span className="text-2xl font-mono font-bold text-blue-400 mt-1 block">
                {bestBucket.consistency !== null ? `${bestBucket.consistency.toFixed(1)}%` : t("randomizer.naSingle")}
              </span>
              <span className="text-[10px] text-text-faint mt-0.5 block">
                {bestBucket.stdDev !== null
                  ? `σ = ±${bestBucket.stdDev.toFixed(1)}`
                  : t("randomizer.needsMultipleRuns")}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-edge">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint block">
                {t("randomizer.sampleSize")}
              </span>
              <span className="text-2xl font-mono font-bold text-text-main mt-1 block">
                {bestBucket.count}
              </span>
              <span className="text-[10px] text-text-faint mt-0.5 block">
                {t("randomizer.totalDataset")}: {analysis.totalRuns}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sensitivity Buckets Breakdown Table */}
      {analysis && analysis.buckets.length > 0 && (
        <div className="panel p-6 rounded-2xl space-y-4">
          <div className="border-b border-edge pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
                {t("randomizer.bucketsTableTitle")}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {t("randomizer.bucketsTableSubtitle")}
              </p>
            </div>
            <span className="text-xs text-text-faint">
              {t("randomizer.globalAverage")}:{" "}
              <strong className="text-text-main font-mono">
                {analysis.globalMeanScore.toFixed(1)}
                {scopeAllTasks ? "%" : " pts"}
              </strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-edge text-[11px] font-bold uppercase tracking-wider text-text-faint">
                  <th className="pb-3 pl-3">{t("randomizer.colRange")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colRuns")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colBayesScore")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colRawAvg")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colPeakScore")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colConsistency")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colConfidence")}</th>
                  <th className="pb-3 pr-3 text-right">{t("randomizer.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {analysis.buckets.map((b, idx) => {
                  const isTop = bestBucket && b.min === bestBucket.min;
                  return (
                    <tr
                      key={b.min}
                      className={`hover:bg-surface-subtle/50 transition-colors ${
                        isTop ? "bg-amber-500/[0.03] font-medium" : ""
                      }`}
                    >
                      <td className="py-3 pl-3 font-mono font-semibold text-text-main flex items-center gap-2">
                        {isTop && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                        )}
                        <span>{b.rangeLabel}</span>
                        {idx === 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber font-sans font-bold">
                            #1
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-text-secondary">{b.count}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {b.weightedScore.toFixed(1)}
                        {scopeAllTasks ? "%" : ""}
                      </td>
                      <td className="py-3 px-3 font-mono text-text-secondary">
                        {b.avgScore.toFixed(1)}
                        {scopeAllTasks ? "%" : ""}
                      </td>
                      <td className="py-3 px-3 font-mono text-text-main font-semibold">
                        {b.maxScore.toFixed(1)}
                        {scopeAllTasks ? "%" : ""}
                      </td>
                      <td className="py-3 px-3 font-mono text-blue-400">
                        {b.consistency !== null ? `${b.consistency.toFixed(1)}%` : t("randomizer.naSingle")}
                      </td>
                      <td className="py-3 px-3">{renderConfidenceBadge(b)}</td>
                      <td className="py-3 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => onApplySens((b.min + b.max) / 2)}
                          className="text-[11px] font-semibold text-text-secondary hover:text-text-main hover:underline"
                        >
                          {t("randomizer.useMidpoint")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Runs History */}
      {recentRuns.length > 0 && (
        <div className="panel p-6 rounded-2xl space-y-4">
          <div className="border-b border-edge pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.recentRunsTitle")}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {t("randomizer.recentRunsSubtitle")}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-edge text-[11px] font-bold uppercase tracking-wider text-text-faint">
                  <th className="pb-3 pl-3">{t("randomizer.colDate")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colScenario")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colSens")}</th>
                  <th className="pb-3 px-3">{t("randomizer.colScore")}</th>
                  <th className="pb-3 pr-3 text-right">{t("randomizer.colThreshold")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentRuns.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="py-3 pl-3 font-mono text-text-faint">{r.date || "-"}</td>
                    <td className="py-3 px-3 font-medium text-text-main">{r.scenario || "-"}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-blue-400">
                      {r.sens.toFixed(1)} cm
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-text-main">
                      {scopeAllTasks ? `${r.normScore?.toFixed(1)}%` : r.rawScore ?? r.score}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-amber">
                      {r.threshold ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
