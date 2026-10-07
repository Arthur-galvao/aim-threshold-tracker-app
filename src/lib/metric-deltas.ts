import type { Task } from "./types.ts";

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
  if (!task || !task.sessions || task.sessions.length < 2) {
    return {
      scoreDelta: null,
      thresholdDelta: null,
    };
  }

  const sessions = task.sessions;
  const lastIndex = sessions.length - 1;
  const lastSession = sessions[lastIndex];
  const prevSession = sessions[lastIndex - 1];

  const lastScore = typeof lastSession.pb === "number" ? lastSession.pb : null;
  const prevScore = typeof prevSession.pb === "number" ? prevSession.pb : null;

  const scoreDelta =
    lastScore !== null && prevScore !== null ? lastScore - prevScore : null;

  const thresholdDelta =
    typeof lastSession.threshold === "number" &&
    typeof prevSession.threshold === "number"
      ? lastSession.threshold - prevSession.threshold
      : null;

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
  if (!task || !task.sessions || task.sessions.length === 0) {
    return [];
  }

  return task.sessions.slice(-limit).map((s) => Number(s.pb) || 0);
}
