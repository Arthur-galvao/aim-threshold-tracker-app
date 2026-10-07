import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatSensitivity } from "@/lib/sens-analytics";
import { getRecommendedSens } from "@/lib/viscose";
import {
  computeMetricDeltas,
  computeTargetProgress,
  extractRecentTrend,
} from "@/lib/metric-deltas";
import {
  Target,
  Trophy,
  TrendUp,
  MouseSimple,
  ArrowUpRight,
  ArrowDownRight,
} from "@phosphor-icons/react";

interface MetricsCardsProps {
  activeTask: Task | null;
}

function MiniSparkline({ data, color = "var(--score)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 20;

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
      className="overflow-visible shrink-0 opacity-80"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function MetricsCards({ activeTask }: MetricsCardsProps) {
  const metrics = computeTaskMetrics(activeTask);
  const deltas = computeMetricDeltas(activeTask);
  const progress = computeTargetProgress(metrics.maxPB, metrics.targetThreshold);
  const recentTrend = extractRecentTrend(activeTask, 6);
  const { t } = useI18n();

  const hasData = activeTask && activeTask.sessions && activeTask.sessions.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
      {/* Primary Hero Card: Target Threshold */}
      <div className="lg:col-span-5 panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between border-edge hover:border-edge-strong transition-colors relative overflow-hidden group">
        {/* Subtle ambient accent aura */}
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-soft pointer-events-none blur-2xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber font-sans">
              <span className="flex items-center text-amber">
                <Target size={15} weight="bold" />
              </span>
              <span>{t("metric.threshold")}</span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">
              {t("session.goalText")}
            </p>
          </div>

          {deltas.thresholdDelta !== null && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                deltas.thresholdDelta >= 0
                  ? "bg-emerald-soft text-emerald border-emerald-edge"
                  : "bg-red-soft text-red border-red-edge"
              }`}
            >
              {deltas.thresholdDelta >= 0 ? (
                <ArrowUpRight size={12} weight="bold" />
              ) : (
                <ArrowDownRight size={12} weight="bold" />
              )}
              {deltas.thresholdDelta >= 0 ? `+${deltas.thresholdDelta}` : deltas.thresholdDelta}
            </span>
          )}
        </div>

        <div className="relative z-10 mt-5 flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight tabular-nums text-amber">
              {hasData && metrics.targetThreshold !== null ? metrics.targetThreshold : "—"}
            </span>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              {t("metric.target")}
            </span>
          </div>

          {progress && (
            <div className="text-right">
              <span className="text-xs font-mono font-semibold text-text-main">
                {progress.percentage}%
              </span>
              <span className="block text-[10px] text-text-faint font-medium">
                {progress.achieved ? "Meta superada" : `${Math.abs(progress.diff)} pts restantes`}
              </span>
            </div>
          )}
        </div>

        {/* Linear progress gauge bar */}
        <div className="relative z-10 mt-4 w-full bg-surface-subtle h-1.5 rounded-full overflow-hidden border border-edge">
          <div
            className="h-full bg-amber transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, progress ? progress.percentage : 0)}%` }}
          />
        </div>
      </div>

      {/* Telemetry Trio Cards */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
        {/* Personal Best (PB) */}
        <div className="panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between border-edge hover:border-edge-strong transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <span className="flex items-center text-text-faint group-hover:text-text-main transition-colors">
                <Trophy size={14} weight="bold" />
              </span>
              <span>{t("metric.pb")}</span>
            </span>
            {recentTrend.length > 1 && <MiniSparkline data={recentTrend} />}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
                {hasData && metrics.maxPB !== null ? metrics.maxPB : "—"}
              </span>
              <span className="text-xs font-medium text-text-faint font-mono">
                {t("metric.pts")}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-text-faint">
              {deltas.scoreDelta !== null ? (
                <span
                  className={
                    deltas.scoreDelta >= 0 ? "text-emerald font-semibold" : "text-red font-semibold"
                  }
                >
                  {deltas.scoreDelta >= 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta} pts
                </span>
              ) : (
                <span>{hasData ? "Linha de base" : "Sem registro"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Consistency */}
        <div className="panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between border-edge hover:border-edge-strong transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <span className="flex items-center text-text-faint group-hover:text-text-main transition-colors">
                <TrendUp size={14} weight="bold" />
              </span>
              <span>{t("metric.consistency")}</span>
            </span>
            {hasData && metrics.consistency !== null && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                parseFloat(metrics.consistency) >= 95
                  ? "bg-emerald-soft text-emerald border-emerald-edge"
                  : parseFloat(metrics.consistency) >= 90
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-surface-subtle text-text-secondary border-edge"
              }`}>
                {parseFloat(metrics.consistency) >= 95
                  ? "Excelente"
                  : parseFloat(metrics.consistency) >= 90
                  ? "Estável"
                  : "Em evolução"}
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
                {hasData && metrics.consistency !== null ? `${metrics.consistency}%` : "—"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-text-faint font-medium">
              {hasData ? "Aderência à meta" : "Aguardando dados"}
            </div>
          </div>
        </div>

        {/* Sensitivity */}
        <div className="panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between border-edge hover:border-edge-strong transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <span className="flex items-center text-text-faint group-hover:text-text-main transition-colors">
                <MouseSimple size={14} weight="bold" />
              </span>
              <span>{t("metric.sens")}</span>
            </span>
            {activeTask && getRecommendedSens(activeTask.category, activeTask.subcategory) && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-text-secondary border border-edge font-medium">
                Alvo: {getRecommendedSens(activeTask.category, activeTask.subcategory)}cm
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
                {hasData && metrics.lastSens !== null
                  ? formatSensitivity(metrics.lastSens, "")
                  : "—"}
              </span>
              <span className="text-xs font-mono font-medium text-text-faint">
                cm/360
              </span>
            </div>
            <div className="mt-1 text-[11px] text-text-faint font-medium">
              {hasData ? "Sensibilidade ativa" : "Não definida"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}