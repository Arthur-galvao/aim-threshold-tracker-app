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
import { BorderBeam } from "@/components/ui/BorderBeam";

interface MetricsCardsProps {
  activeTask: Task | null;
  allTasks?: Task[];
  mouseDpi?: number;
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

export function MetricsCards({ activeTask, allTasks = [], mouseDpi }: MetricsCardsProps) {
  const { t } = useI18n();
  const dpi = mouseDpi || 800;
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

  const idealSens = activeTask ? getScenarioIdealSens(activeTask, allTasks, dpi) : null;
  const recSens = idealSens
    ? idealSens.value
    : activeTask
      ? getRecommendedSens(activeTask.category, activeTask.subcategory)
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {/* 1. HERO BLOCK: TARGET THRESHOLD & META DE HOJE (3 colunas no desktop) */}
      <SpotlightCard
        isFeatured={true}
        spotlightColor="rgba(var(--score-rgb) / 0.18)"
        style={{ "--i": 0 } as React.CSSProperties}
        className="enter col-span-1 sm:col-span-2 lg:col-span-3 p-4 sm:p-5 flex flex-col justify-between min-h-[110px] bg-glass-bg border border-score/30 hover:border-score/50 transition-colors rounded-2xl relative overflow-hidden"
      >
        <BorderBeam size={160} duration={14} colorFrom="rgba(var(--score-rgb) / 0.7)" colorTo="rgba(var(--score-rgb) / 0.15)" />
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Lado Esquerdo: Target Threshold Focal (7 colunas) */}
          <div className="md:col-span-7 flex flex-col justify-between pr-0 md:pr-4 md:border-r border-glass-edge/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-score animate-pulse" />
                <span className="text-[10px] font-mono font-bold tracking-wider text-score uppercase">
                  {t("metric.threshold")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {deltas.thresholdDelta !== null && (
                  <span
                    className={`text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                      deltas.thresholdDelta > 0
                        ? "text-emerald bg-emerald-soft border border-emerald-edge"
                        : deltas.thresholdDelta < 0
                          ? "text-red bg-red-soft border border-red-edge"
                          : "text-text-faint bg-glass-bg border border-glass-edge"
                    }`}
                  >
                    {deltas.thresholdDelta > 0 ? `+${deltas.thresholdDelta}` : deltas.thresholdDelta}
                  </span>
                )}
                <span
                  className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-score-soft text-score border border-score/30 cursor-help"
                  title={t("metric.targetExplanation")}
                >
                  TARGET
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-3 mt-1.5">
              {hasData && metrics.targetThreshold !== null ? (
                <NumberTicker
                  value={metrics.targetThreshold}
                  decimalPlaces={Number.isInteger(metrics.targetThreshold) ? 0 : 1}
                  className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-text-main tabular-nums"
                />
              ) : (
                <span className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-text-main">
                  —
                </span>
              )}
              {ratioPct && (
                <span className="text-[11px] font-mono text-text-faint tabular-nums">
                  {t("metric.thresholdRatio", { pct: ratioPct })}
                </span>
              )}
            </div>

            <div className="mt-1.5 text-[10px] font-mono text-text-faint flex items-center gap-2">
              <span>{t("metric.targetExplanation")}</span>
              {metrics.streak > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-soft text-amber border border-amber-edge font-semibold tabular-nums">
                  {t("metric.streak", { n: metrics.streak })}
                </span>
              )}
            </div>
          </div>

          {/* Lado Direito: Meta de Hoje & Progresso Diário (5 colunas) */}
          <div className="md:col-span-5 flex flex-col justify-between pl-0 md:pl-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
                {t("metric.todayTarget")}
              </span>
              {todaySummary && (
                <span
                  className={`text-[10px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded-full ${
                    todaySummary.hit
                      ? "text-emerald bg-emerald-soft border border-emerald-edge"
                      : "text-amber bg-amber-soft border border-amber-edge"
                  }`}
                >
                  {todaySummary.hit ? "HIT" : `${todayProgressPct}%`}
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-score tabular-nums">
                {hasData && todayTarget !== null ? todayTarget : "—"}
              </span>
              {todaySummary && (
                <span className="text-[10px] font-mono text-text-secondary tabular-nums">
                  {t("metric.todayRuns", { best: todaySummary.best, runs: todaySummary.runs })}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1">
              <div className="w-full h-1.5 bg-glass-bg-elevated rounded-full overflow-hidden border border-glass-edge">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    todaySummary?.hit ? "bg-emerald" : "bg-score"
                  }`}
                  style={{ width: `${todayProgressPct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-text-faint truncate">
                {todaySummary ? (
                  todaySummary.hit
                    ? t("metric.todayTargetReached")
                    : t("metric.todayProgressPct", { pct: todayProgressPct })
                ) : (
                  t("metric.noRunsToday")
                )}
              </span>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 2. CARD PB & TENDÊNCIA RECENTE (1 coluna no desktop) */}
      <SpotlightCard
        style={{ "--i": 1 } as React.CSSProperties}
        className="enter lift col-span-1 p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] bg-glass-bg border border-glass-edge hover:border-glass-edge-strong transition-all rounded-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.pb")}
          </span>
          {recentTrend.length > 1 && (
            <MiniSparkline data={recentTrend} color="var(--score)" />
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2">
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
              className={`text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                deltas.scoreDelta > 0
                  ? "text-emerald bg-emerald-soft border border-emerald-edge"
                  : deltas.scoreDelta < 0
                    ? "text-red bg-red-soft border border-red-edge"
                    : "text-text-faint bg-glass-bg border border-glass-edge"
              }`}
            >
              {deltas.scoreDelta > 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta}
            </span>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint flex items-center justify-between">
          <span>{recentTrend.length > 0 ? t("metric.sessionsCount", { n: recentTrend.length }) : "—"}</span>
          <span className="text-[9px] text-text-secondary opacity-80">Trendline</span>
        </div>
      </SpotlightCard>

      {/* 3. CARD CONSISTÊNCIA & SENSIBILIDADE IDEAL (1 coluna no desktop) */}
      <SpotlightCard
        style={{ "--i": 2 } as React.CSSProperties}
        className="enter lift col-span-1 p-3.5 sm:p-4 flex flex-col justify-between min-h-[110px] bg-glass-bg border border-glass-edge hover:border-glass-edge-strong transition-all rounded-2xl"
      >
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
            {t("metric.hitRate")} & SENS
          </span>
          {hitRateBadge && (
            <span className={`text-[8px] font-mono font-semibold px-2 py-0.5 rounded-full ${hitRateBadge.cls}`}>
              {hitRateBadge.text}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-text-main tabular-nums">
            {hasData && metrics.hitRate !== null ? `${metrics.hitRate}%` : "—"}
          </span>
          <span className="text-xs font-mono font-bold text-score tabular-nums">
            {recSens ? `${recSens}cm` : "—"}
          </span>
        </div>
        <div className="mt-2 text-[10px] font-mono text-text-faint flex items-center justify-between">
          <span className="tabular-nums">
            {hasData && metrics.lastSens !== null
              ? t("metric.currentSens", { val: formatSensitivity(metrics.lastSens, dpi, "") })
              : "—"}
          </span>
          {idealSens && (
            <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-glass-bg border border-glass-edge text-text-secondary">
              {idealSens.source === "empirical" ? "EMP" : "VIS"}
            </span>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}