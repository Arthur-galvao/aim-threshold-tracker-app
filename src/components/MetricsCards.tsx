import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
import { summarizeDays } from "@/lib/day-summary";
import { formatSensitivity, getScenarioIdealSens } from "@/lib/sens-analytics";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import {
  computeMetricDeltas,
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
  const recentTrend = extractRecentTrend(activeTask, 6);

  const hasData = Boolean(
    activeTask && activeTask.sessions && activeTask.sessions.length > 0
  );

  const summaries = summarizeDays(activeTask);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todaySummary = summaries.find((d) => d.date === todayStr) ?? null;

  const todayTarget = hasData
    ? (todaySummary?.targetBefore ?? metrics.targetThreshold)
    : null;

  const todayProgressPct =
    todaySummary && todayTarget && todayTarget > 0
      ? Math.min(100, Math.round((todaySummary.best / todayTarget) * 100))
      : 0;

  const hitRateBadge =
    metrics.hitRate !== null
      ? metrics.hitRate >= 80
        ? { text: t("metric.consistencyHigh"), cls: "bg-emerald-soft text-emerald border border-emerald-edge" }
        : metrics.hitRate >= 60
          ? { text: t("metric.consistencyMed"), cls: "bg-amber-soft text-amber border border-amber-edge" }
          : { text: t("metric.consistencyVar"), cls: "bg-surface-subtle text-text-faint border border-edge" }
      : null;

  const ratioPct =
    metrics.maxPB && metrics.targetThreshold && metrics.maxPB > 0
      ? ((metrics.targetThreshold / metrics.maxPB) * 100).toFixed(1)
      : null;

  const idealSens = activeTask ? getScenarioIdealSens(activeTask, allTasks) : null;
  const recSens = idealSens
    ? idealSens.value
    : activeTask
      ? getRecommendedSens(activeTask.category, activeTask.subcategory)
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
      {/* 1. META DE HOJE */}
      <SpotlightCard className="p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px] sm:min-h-[96px] bg-surface border border-score/40 hover:border-score transition-colors relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-score uppercase">
            {t("metric.todayTarget")}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-score-soft text-score border border-score/30 cursor-help"
            title={t("metric.targetExplanation")}
          >
            {t("metric.target")}
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-2 sm:mt-2.5">
          {hasData && todayTarget !== null ? (
            <NumberTicker
              value={todayTarget}
              decimalPlaces={Number.isInteger(todayTarget) ? 0 : 1}
              className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-score"
            />
          ) : (
            <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-score">
              —
            </span>
          )}
          {todaySummary && (
            <span
              className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                todaySummary.hit
                  ? "text-emerald bg-emerald-soft"
                  : "text-amber bg-amber-soft"
              }`}
            >
              {todaySummary.hit ? "HIT" : `${todayProgressPct}%`}
            </span>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint truncate">
          {todaySummary ? (
            <div className="flex flex-col gap-1">
              <span className="truncate">
                {t("metric.todayRuns", {
                  best: todaySummary.best,
                  runs: todaySummary.runs,
                })}
              </span>
              <div className="w-full h-1 bg-surface-subtle rounded-full overflow-hidden border border-edge">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    todaySummary.hit ? "bg-emerald" : "bg-score"
                  }`}
                  style={{ width: `${todayProgressPct}%` }}
                />
              </div>
            </div>
          ) : (
            <span>{t("metric.noRunsToday")}</span>
          )}
        </div>
      </SpotlightCard>

      {/* 2. THRESHOLD ATUAL */}
      <SpotlightCard className="p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px] sm:min-h-[96px] bg-surface border border-edge hover:border-edge-strong transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.threshold")}
          </span>
          {deltas.thresholdDelta !== null && (
            <span
              className={`text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                deltas.thresholdDelta > 0
                  ? "text-emerald bg-emerald-soft border border-emerald-edge"
                  : deltas.thresholdDelta < 0
                    ? "text-red bg-red-soft border border-red-edge"
                    : "text-text-faint bg-surface-subtle border border-edge"
              }`}
            >
              {deltas.thresholdDelta > 0
                ? `+${deltas.thresholdDelta}`
                : deltas.thresholdDelta}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2 sm:mt-2.5">
          {hasData && metrics.targetThreshold !== null ? (
            <NumberTicker
              value={metrics.targetThreshold}
              decimalPlaces={Number.isInteger(metrics.targetThreshold) ? 0 : 1}
              className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main"
            />
          ) : (
            <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main">
              —
            </span>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint">
          {ratioPct ? t("metric.thresholdRatio", { pct: ratioPct }) : "—"}
        </div>
      </SpotlightCard>

      {/* 3. PB */}
      <SpotlightCard className="p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px] sm:min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.pb")}
          </span>
          {recentTrend.length > 1 && (
            <MiniSparkline data={recentTrend} color="var(--text-secondary)" />
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2 sm:mt-2.5">
          {hasData && metrics.maxPB !== null ? (
            <NumberTicker
              value={metrics.maxPB}
              decimalPlaces={Number.isInteger(metrics.maxPB) ? 0 : 1}
              className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main"
            />
          ) : (
            <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main">
              —
            </span>
          )}
          {deltas.scoreDelta !== null && (
            <span
              className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                deltas.scoreDelta > 0
                  ? "text-emerald bg-emerald-soft"
                  : deltas.scoreDelta < 0
                    ? "text-red bg-red-soft"
                    : "text-text-faint bg-surface-subtle"
              }`}
            >
              {deltas.scoreDelta > 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta}
            </span>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint">
          {recentTrend.length > 0
            ? `${recentTrend.length} ${t("hist.colDate").toLowerCase()}s`
            : "—"}
        </div>
      </SpotlightCard>

      {/* 4. HIT RATE / STREAK */}
      <SpotlightCard className="p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px] sm:min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.hitRate")}
          </span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              metrics.streak > 0
                ? "bg-amber-soft text-amber border border-amber-edge font-semibold"
                : "bg-surface-subtle text-text-faint border border-edge"
            }`}
          >
            {metrics.streak > 0
              ? t("metric.streak", { n: metrics.streak })
              : t("metric.noStreak")}
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-2 sm:mt-2.5">
          <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main">
            {hasData && metrics.hitRate !== null ? `${metrics.hitRate}%` : "—"}
          </span>
          {hitRateBadge && (
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${hitRateBadge.cls}`}>
              {hitRateBadge.text}
            </span>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint">
          {t("metric.streak", { n: metrics.streak })}
        </div>
      </SpotlightCard>

      {/* 5. MOUSE SENSITIVITY */}
      <SpotlightCard className="p-3.5 sm:p-4 flex flex-col justify-between min-h-[92px] sm:min-h-[96px] bg-surface border border-edge hover:bg-surface-hover/40 transition-colors">
        <div className="flex items-center justify-between gap-1 sm:gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.sens")}
          </span>
          {idealSens && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-edge text-text-secondary flex items-center gap-1 shrink-0"
              title={
                idealSens.source === "empirical"
                  ? t("randomizer.idealSensSourceEmpirical")
                  : t("randomizer.idealSensSourceViscose")
              }
            >
              <span>{t("metric.targetSens")} {recSens}cm</span>
              <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-normal">
                {idealSens.source === "empirical" ? "EMP" : "VIS"}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2 sm:mt-2.5">
          <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main">
            {hasData && metrics.lastSens !== null
              ? `${formatSensitivity(metrics.lastSens, "")}`
              : "—"}
            {hasData && metrics.lastSens !== null && (
              <span className="text-xs font-normal text-text-faint ml-1">cm</span>
            )}
          </span>
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint">
          {recSens ? `${recSens}cm ${t("metric.target")}` : "—"}
        </div>
      </SpotlightCard>
    </div>
  );
}