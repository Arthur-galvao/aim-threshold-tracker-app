import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
import { formatSensitivity, getScenarioIdealSens } from "@/lib/sens-analytics";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import {
  computeMetricDeltas,
  computeTargetProgress,
  extractRecentTrend,
} from "@/lib/metric-deltas";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface MetricsCardsProps {
  activeTask: Task | null;
  allTasks?: Task[];
}

function MiniSparkline({
  data,
  color = "var(--score)",
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 56;
  const height = 18;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible shrink-0 opacity-70"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function MetricsCards({ activeTask, allTasks }: MetricsCardsProps) {
  const { t } = useI18n();
  const metrics = computeTaskMetrics(activeTask);
  const deltas = computeMetricDeltas(activeTask);
  const progress = computeTargetProgress(metrics.maxPB, metrics.targetThreshold);
  const recentTrend = extractRecentTrend(activeTask, 6);

  const hasData =
    Boolean(activeTask && activeTask.sessions && activeTask.sessions.length > 0);

  const consistencyDisplay = metrics.consistency
    ? metrics.consistency.endsWith("%")
      ? metrics.consistency
      : `${metrics.consistency}%`
    : "—";

  const consistencyNum = metrics.consistency ? parseFloat(metrics.consistency) : null;
  const consistencyBadge = consistencyNum !== null ? (
    consistencyNum >= 90 ? { text: t("metric.consistencyHigh"), cls: "bg-emerald-soft text-emerald border border-emerald-edge" } :
    consistencyNum >= 80 ? { text: t("metric.consistencyMed"), cls: "bg-amber-soft text-amber border border-amber-edge" } :
    { text: t("metric.consistencyVar"), cls: "bg-surface-subtle text-text-faint border border-edge" }
  ) : null;

  const idealSens = activeTask ? getScenarioIdealSens(activeTask, allTasks) : null;
  const recSens = idealSens ? idealSens.value : (activeTask ? getRecommendedSens(activeTask.category, activeTask.subcategory) : null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. BEST SCORE */}
      <SpotlightCard className="p-4 flex flex-col justify-between min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.pb")}
          </span>
          {recentTrend.length > 1 && (
            <MiniSparkline data={recentTrend} color="var(--text-secondary)" />
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          {hasData && metrics.maxPB !== null ? (
            <NumberTicker
              value={metrics.maxPB}
              decimalPlaces={Number.isInteger(metrics.maxPB) ? 0 : 1}
              className="text-3xl font-mono font-bold tracking-tight text-text-main"
            />
          ) : (
            <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
              —
            </span>
          )}
          {deltas.scoreDelta !== null && (
            <span
              className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                deltas.scoreDelta >= 0
                  ? "text-emerald bg-emerald-soft"
                  : "text-red bg-red-soft"
              }`}
            >
              {deltas.scoreDelta >= 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta}
            </span>
          )}
        </div>
      </SpotlightCard>

      {/* 2. TARGET THRESHOLD */}
      <SpotlightCard className="p-4 flex flex-col justify-between min-h-[96px] bg-surface border border-edge hover:border-edge-strong transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-score uppercase">
            {t("metric.threshold")}
          </span>
          {progress && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle border border-edge text-text-secondary">
              {progress.percentage}%
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          {hasData && metrics.targetThreshold !== null ? (
            <NumberTicker
              value={metrics.targetThreshold}
              decimalPlaces={Number.isInteger(metrics.targetThreshold) ? 0 : 1}
              className="text-3xl font-mono font-bold tracking-tight text-score"
            />
          ) : (
            <span className="text-3xl font-mono font-bold tracking-tight text-score">
              —
            </span>
          )}
          {deltas.thresholdDelta !== null && (
            <span
              className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                deltas.thresholdDelta >= 0
                  ? "text-score bg-score-soft"
                  : "text-red bg-red-soft"
              }`}
            >
              {deltas.thresholdDelta >= 0
                ? `+${deltas.thresholdDelta}`
                : deltas.thresholdDelta}
            </span>
          )}
        </div>
      </SpotlightCard>

      {/* 3. CONSISTENCY */}
      <SpotlightCard className="p-4 flex flex-col justify-between min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.consistency")}
          </span>
          {consistencyBadge && (
            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${consistencyBadge.cls}`}>
              {consistencyBadge.text}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
            {hasData ? consistencyDisplay : "—"}
          </span>
        </div>
      </SpotlightCard>

      {/* 4. MOUSE SENSITIVITY */}
      <SpotlightCard className="p-4 flex flex-col justify-between min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.sens")}
          </span>
          {idealSens && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-edge text-text-secondary flex items-center gap-1"
              title={idealSens.source === "empirical" ? t("randomizer.idealSensSourceEmpirical") : t("randomizer.idealSensSourceViscose")}
            >
              <span>{t("metric.targetSens")} {recSens}cm</span>
              <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-normal">
                {idealSens.source === "empirical" ? "EMP" : "VIS"}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
            {hasData && metrics.lastSens !== null
              ? `${formatSensitivity(metrics.lastSens, "")}`
              : "—"}
            {hasData && metrics.lastSens !== null && (
              <span className="text-xs font-normal text-text-faint ml-1">cm</span>
            )}
          </span>
        </div>
      </SpotlightCard>

      {/* 5. TOTAL SESSIONS */}
      <SpotlightCard className="p-4 flex flex-col justify-between min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("hist.title")}
          </span>
          {hasData && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-edge text-text-faint">
              {t("metric.total")}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          <NumberTicker
            value={activeTask?.sessions.length ?? 0}
            decimalPlaces={0}
            className="text-3xl font-mono font-bold tracking-tight text-text-main"
          />
          <span className="text-xs font-mono text-text-faint">
            {t("scenarioList.sessions")}
          </span>
        </div>
      </SpotlightCard>
    </div>
  );
}