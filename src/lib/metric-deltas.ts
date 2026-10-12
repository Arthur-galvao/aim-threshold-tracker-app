import type { Task } from "./types.ts";
import { summarizeDays } from "./day-summary.ts";

export interface MetricDeltas {
  scoreDelta: number | null;
  thresholdDelta: number | null;
}

export interface TargetProgress {
  achieved: boolean;
  diff: number;
  percentage: number;
}

export function computeMetricDeltas(task: Task | null): MetricDeltas {
  const days = summarizeDays(task);
  if (days.length < 2) {
    return {
      scoreDelta: null,
      thresholdDelta: null,
    };
  }

  const lastDay = days[days.length - 1];
  const prevDay = days[days.length - 2];

  const scoreDelta = lastDay.best - prevDay.best;
  const thresholdDelta = lastDay.threshold - prevDay.threshold;

  return {
    scoreDelta,
    thresholdDelta,
  };
}

export function computeTargetProgress(
  currentScore: number | null,
  targetThreshold: number | null
): TargetProgress | null {
  if (currentScore === null || targetThreshold === null || targetThreshold <= 0) {
    return null;
  }

  const diff = currentScore - targetThreshold;
  const achieved = diff >= 0;
  const percentage = Math.round((currentScore / targetThreshold) * 100);

  return {
    achieved,
    diff,
    percentage,
  };
}

export function extractRecentTrend(task: Task | null, limit: number = 6): number[] {
  const days = summarizeDays(task);
  if (days.length === 0) {
    return [];
  }

  return days.slice(-limit).map((d) => d.best);
}
