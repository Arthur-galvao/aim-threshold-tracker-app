import { motion } from "motion/react";
import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
import { formatSensitivity } from "@/lib/sens-analytics";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import {
  computeMetricDeltas,
  computeTargetProgress,
  extractRecentTrend,
} from "@/lib/metric-deltas";


interface MetricsCardsProps {
  activeTask: Task | null;
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

function formatScoreValue(val: number | null): string {
  if (val === null) return "—";
  return Number.isInteger(val) ? val.toString() : val.toFixed(1);
}

export function MetricsCards({ activeTask }: MetricsCardsProps) {
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

  const recSens = activeTask ? getRecommendedSens(activeTask.category, activeTask.subcategory) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. BEST SCORE */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-4 flex flex-col justify-between min-h-[96px] rounded-xl transition-colors bg-[#12141e]/60 hover:bg-[#12141e]/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
              {t("metric.pb")}
            </span>
            {recentTrend.length > 1 && (
              <MiniSparkline data={recentTrend} color="var(--text-secondary)" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
              {hasData ? formatScoreValue(metrics.maxPB) : "—"}
            </span>
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
        </div>
      </motion.div>

      {/* 2. TARGET THRESHOLD */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.04 }}
      >
        <div className="p-4 flex flex-col justify-between min-h-[96px] rounded-xl transition-colors bg-[#12141e]/60 hover:bg-[#12141e]/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
              {t("metric.threshold")}
            </span>
            {progress && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle text-text-faint border border-edge">
                {progress.percentage}%
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
              {hasData ? formatScoreValue(metrics.targetThreshold) : "—"}
            </span>
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
        </div>
      </motion.div>

      {/* 3. TARGET METRICS / CONSISTENCY (Featured Card - 3rd) */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.08 }}
      >
        <div className="p-4 flex flex-col justify-between min-h-[96px] rounded-xl bg-score/10 shadow-[0_0_20px_-3px_rgba(56,189,248,0.1)] transition-colors">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-medium tracking-wider text-score uppercase">
              {t("metric.consistency")}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-score">
              {hasData ? consistencyDisplay : "—"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 4. MOUSE SENSITIVITY */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.12 }}
      >
        <div className="p-4 flex flex-col justify-between min-h-[96px] rounded-xl transition-colors bg-[#12141e]/60 hover:bg-[#12141e]/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
              {t("metric.sens")}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2.5">
            <div className="flex flex-col">
              <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
                {hasData && metrics.lastSens !== null
                  ? `${formatSensitivity(metrics.lastSens, "")}`
                  : "—"}
                {hasData && metrics.lastSens !== null && (
                  <span className="text-xs font-normal text-text-faint ml-1">cm</span>
                )}
              </span>
              {recSens && (
                <span className="text-[9px] font-mono text-text-faint mt-0.5">
                  TGT: {recSens}cm
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 5. TOTAL SESSIONS */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.16 }}
      >
        <div className="p-4 flex flex-col justify-between min-h-[96px] rounded-xl transition-colors bg-[#12141e]/60 hover:bg-[#12141e]/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-medium tracking-wider text-text-faint uppercase">
              {t("hist.title")}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2.5">
            <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
              {activeTask?.sessions.length ?? 0}
            </span>
            <span className="text-xs font-mono text-text-faint">
              {t("scenarioList.sessions")}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}