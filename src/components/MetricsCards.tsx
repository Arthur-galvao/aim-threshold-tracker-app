import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
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

  const hasData = activeTask && activeTask.sessions && activeTask.sessions.length > 0;

  return (
    <div className="panel relative overflow-hidden flex flex-col border border-edge rounded-[10px]">
      {/* Progress Bar (Idea C) */}
      <div className="h-1 w-full bg-surface-subtle">
        <div
          className="h-full bg-emerald transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, progress ? progress.percentage : 0)}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-edge bg-surface">
        {/* PB */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 group relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
              <span className="text-text-faint group-hover:text-text-main transition-colors">
                <Trophy size={14} weight="bold" />
              </span>
              BEST SCORE
            </span>
            {recentTrend.length > 1 && <MiniSparkline data={recentTrend} />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
              {hasData && metrics.maxPB !== null ? metrics.maxPB : "—"}
            </span>
            {deltas.scoreDelta !== null && (
              <span
                className={`text-[11px] font-mono font-medium ${
                  deltas.scoreDelta >= 0 ? "text-emerald" : "text-red"
                }`}
              >
                {deltas.scoreDelta >= 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta}
              </span>
            )}
          </div>
        </div>

        {/* THRESHOLD */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 group relative overflow-hidden">
          {/* Subtle acid lime glow for active target (Idea B) */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald/5 blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald flex items-center gap-1.5">
              <span className="text-emerald">
                <Target size={14} weight="bold" />
              </span>
              THRESHOLD
            </span>
            {progress && (
              <span className="text-[10px] font-mono font-medium text-text-secondary">
                {progress.percentage}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tracking-tight tabular-nums text-emerald">
              {hasData && metrics.targetThreshold !== null ? metrics.targetThreshold : "—"}
            </span>
            {deltas.thresholdDelta !== null && (
              <span
                className={`text-[11px] font-mono font-medium ${
                  deltas.thresholdDelta >= 0 ? "text-emerald" : "text-red"
                }`}
              >
                {deltas.thresholdDelta >= 0 ? `+${deltas.thresholdDelta}` : deltas.thresholdDelta}
              </span>
            )}
          </div>
        </div>

        {/* CONSISTENCY */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
              <span className="text-text-faint group-hover:text-text-main transition-colors">
                <TrendUp size={14} weight="bold" />
              </span>
              CONSISTENCY
            </span>
            {hasData && metrics.consistency !== null && (
              <span className={`w-1.5 h-1.5 rounded-full ${parseFloat(metrics.consistency) >= 90 ? "bg-emerald" : "bg-amber"}`} />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
              {hasData && metrics.consistency !== null ? `${metrics.consistency}%` : "—"}
            </span>
          </div>
        </div>

        {/* SENSITIVITY */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
              <span className="text-text-faint group-hover:text-text-main transition-colors">
                <MouseSimple size={14} weight="bold" />
              </span>
              SENS CM/360
            </span>
            {activeTask && getRecommendedSens(activeTask.category, activeTask.subcategory) && (
              <span className="text-[10px] font-mono text-text-faint">
                TGT: {getRecommendedSens(activeTask.category, activeTask.subcategory)}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tracking-tight tabular-nums text-text-main">
              {hasData && metrics.lastSens !== null
                ? formatSensitivity(metrics.lastSens, "")
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}