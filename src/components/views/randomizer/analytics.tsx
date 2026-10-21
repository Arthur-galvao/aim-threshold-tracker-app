import { useMemo } from "react";
import { Sparkle, Check, Info } from "@phosphor-icons/react";
import { useI18n, type Key } from "@/lib/i18n";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import {
  predictOptimalSensitivity,
  PREDICTOR_PROFILES,
  type PredictorProfile,
  type SweetSpotAnalysis,
  type RunDataPoint,
  type BucketStat,
} from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Segmented } from "@/components/ui/Segmented";
import { BucketsTable } from "./buckets-table";
import { cn } from "@/lib/utils";

export interface AnalyticsProps {
  analysis: SweetSpotAnalysis | null;
  relevantSessions: RunDataPoint[];
  groupRuns?: RunDataPoint[];
  scopeAllTasks: boolean;
  onApplySens: (sensCm: number) => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
}

const VALID_PROFILES: PredictorProfile[] = [
  "equilibrado",
  "neutro",
  "teorico",
  "consistencia",
];

export function Analytics({
  analysis,
  relevantSessions,
  groupRuns,
  scopeAllTasks,
  onApplySens,
  className,
  style,
}: AnalyticsProps) {
  const { t } = useI18n();
  const { settings, saveSettings } = useSensRandomizer();

  const selectedProfile: PredictorProfile =
    settings.predictorProfile &&
    VALID_PROFILES.includes(settings.predictorProfile as PredictorProfile)
      ? (settings.predictorProfile as PredictorProfile)
      : "equilibrado";

  const handleSelectProfile = (profile: string) => {
    void saveSettings({ ...settings, predictorProfile: profile }, true);
  };

  const prediction = useMemo(() => {
    return predictOptimalSensitivity(relevantSessions, selectedProfile, {
      groupRuns,
    });
  }, [relevantSessions, selectedProfile, groupRuns]);

  const bestBucket = analysis?.bestBucket ?? null;

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

  const profileOptions = VALID_PROFILES.map((p) => ({
    value: p,
    label: t(PREDICTOR_PROFILES[p].labelKey as Key),
  }));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const hasAnyData =
    Boolean(analysis && bestBucket) ||
    Boolean(prediction) ||
    Boolean(analysis && analysis.buckets.length > 0);

  if (!hasAnyData) {
    return (
      <div
        style={style}
        onMouseMove={handleMouseMove}
        className={cn(
          "liquid-surface liquid-interactive p-8 rounded-tile",
          className
        )}
      >
        <EmptyState
          title={t("randomizer.predictorTitle")}
          description={t("randomizer.chartEmpty")}
        />
      </div>
    );
  }

  return (
    <div style={style} className={cn("space-y-4", className)}>
      {/* Sweet Spot Recommendation Hero Card */}
      {analysis && bestBucket && (
        <div
          onMouseMove={handleMouseMove}
          className="liquid-surface liquid-interactive p-5 rounded-tile space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-edge">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-text-main tracking-tight">
                  {t("randomizer.sweetSpotTitle")}
                </h2>
                {getConfidenceBadge(bestBucket.confidenceLevel)}
                {analysis.isProvisional && (
                  <Badge variant="amber">{t("randomizer.badgeProvisional")}</Badge>
                )}
              </div>
              <p className="text-[11px] text-text-faint mt-0.5">
                {analysis.isProvisional
                  ? t("randomizer.sampleSizeExplanation", { n: analysis.minEligibleRuns })
                  : t("randomizer.sweetSpotSubtitle")}
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => void onApplySens(bestBucket.sens)}
              icon={<Check size={14} />}
              className="rounded-full"
            >
              <span>{t("randomizer.applySensBtn")}</span>
              <span className="font-mono tabular">({bestBucket.label})</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.optimalSens")}
              </span>
              <span className="text-2xl font-mono font-bold text-text-main mt-1 block tabular">
                {bestBucket.label}
              </span>
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {scopeAllTasks ? t("randomizer.weightedNormScore") : t("randomizer.weightedScore")}
              </span>
              <NumberTicker
                value={bestBucket.weightedScore}
                decimalPlaces={1}
                suffix={scopeAllTasks ? "%" : ""}
                className="text-2xl font-mono font-bold text-emerald mt-1 block tabular"
              />
              <span className="text-[11px] text-text-faint font-mono tabular block mt-0.5">
                {t("randomizer.rawAvg")}: {bestBucket.avgScore.toFixed(1)}
                {scopeAllTasks ? "%" : " pts"}
              </span>
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.consistencyScore")}
              </span>
              {bestBucket.consistency !== null ? (
                <NumberTicker
                  value={bestBucket.consistency}
                  decimalPlaces={1}
                  suffix="%"
                  className="text-2xl font-mono font-bold text-score mt-1 block tabular"
                />
              ) : (
                <span className="text-2xl font-mono font-bold text-score mt-1 block tabular">
                  {t("randomizer.naSingle")}
                </span>
              )}
              <span className="text-[11px] text-text-faint font-mono tabular block mt-0.5">
                {bestBucket.stdDev !== null ? `σ = ±${bestBucket.stdDev.toFixed(1)}` : t("randomizer.needsMultipleRuns")}
              </span>
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.sampleSize")}
              </span>
              <NumberTicker
                value={bestBucket.count}
                className="text-2xl font-mono font-bold text-text-main mt-1 block tabular"
              />
              <span className="text-[11px] text-text-faint font-mono tabular block mt-0.5">
                {t("randomizer.totalDataset")}: {analysis.totalRuns}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Experimental Sensitivity Predictor Card */}
      {prediction && (
        <div
          onMouseMove={handleMouseMove}
          className="liquid-surface liquid-interactive p-5 rounded-tile space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-edge">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle size={15} weight="fill" className="text-score" />
                <h2 className="text-xs font-semibold text-text-main tracking-tight">
                  {t("randomizer.predictorTitle")}
                </h2>
                {getConfidenceBadge(prediction.confidence)}
              </div>
              <p className="text-[11px] text-text-faint mt-0.5">
                {t("randomizer.predictorSubtitle")}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onApplySens(prediction.predictedSens)}
              icon={<Check size={14} />}
              className="rounded-full"
            >
              <span>{t("randomizer.applySensBtn")}</span>
              <span className="font-mono tabular">({prediction.label})</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.predictorSens")}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <NumberTicker
                  value={prediction.predictedSens}
                  decimalPlaces={1}
                  className="text-2xl font-mono font-bold text-score tabular"
                />
                <span className="text-xs font-mono text-text-secondary">cm/360</span>
              </div>
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.predictorApex")}
              </span>
              <span className="text-xl font-mono font-bold text-text-main mt-1 block tabular">
                {prediction.vertexSens !== null ? `${prediction.vertexSens.toFixed(1)} cm` : "-"}
              </span>
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.predictorObserved")}
              </span>
              <NumberTicker
                value={prediction.empiricalSens}
                decimalPlaces={1}
                suffix=" cm"
                className="text-xl font-mono font-bold text-emerald mt-1 block tabular"
              />
            </div>

            <div className="liquid-well p-3.5 rounded-control hover:border-edge-strong transition-colors">
              <span className="text-[11px] text-text-faint font-medium block">
                {t("randomizer.predictorBasis")}
              </span>
              <span className="text-xs font-mono font-bold text-score mt-1 block tabular">
                {prediction.basis === "curvature_blend"
                  ? `${Math.round(prediction.teoricoWeight * 100)}% / ${Math.round(prediction.consistenciaWeight * 100)}%`
                  : t("randomizer.predictorBasisEmpirical")}
              </span>
            </div>
          </div>

          {/* Profile Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs font-semibold text-text-secondary">
              {t("randomizer.predictorProfile")}
            </span>
            <Segmented
              id="predictor-profile-selector"
              options={profileOptions}
              value={selectedProfile}
              onChange={handleSelectProfile}
              size="sm"
            />
          </div>

          {/* Confidence Interval & Uncertainty reasons */}
          {prediction.ci && prediction.ci.low != null && prediction.ci.high != null && (
            <div className="text-xs font-mono text-text-secondary liquid-well p-2.5 rounded-control flex items-center justify-between">
              <span className="text-text-faint">{t("randomizer.confidenceInterval")}:</span>
              <span className="text-score font-semibold tabular">
                {prediction.ci.low.toFixed(1)} cm - {prediction.ci.high.toFixed(1)} cm
              </span>
            </div>
          )}

          {(prediction.confidence === "low" || prediction.confidence === "insufficient") &&
            prediction.reasons &&
            prediction.reasons.length > 0 && (
              <div className="p-3 rounded-control liquid-well bg-amber-soft/50 border border-amber-edge text-xs text-amber space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info size={14} weight="fill" />
                  <span>{t("randomizer.reasonsTitle")}</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                  {prediction.reasons.map((rKey, idx) => (
                    <li key={idx}>{t(rKey as Key)}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* Buckets Breakdown Table */}
      {analysis && analysis.buckets.length > 0 && (
        <BucketsTable
          buckets={analysis.buckets}
          globalMeanScore={analysis.globalMeanScore}
          scopeAllTasks={scopeAllTasks}
          onApplySens={onApplySens}
        />
      )}
    </div>
  );
}
