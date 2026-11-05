import type { SkillSummary } from "./skill/skill-model.ts";
import type { TrainingSessionSummary } from "./day-summary.ts";

export interface MetricDeltas {
  /** Melhor score bruto da última sessão menos o da anterior. */
  scoreDelta: number | null;
  /** Meta da última sessão menos a da anterior (a meta pode descer). */
  targetDelta: number | null;
}

export interface TargetProgress {
  achieved: boolean;
  diff: number;
  percentage: number;
}

/** Métricas derivadas do `SkillSummary` para o contexto do workspace. */
export interface ComputedMetrics {
  skill: SkillSummary | null;
  nextTarget: number | null;
  nextStretch: number | null;
  mu: number | null;
  sigma: number | null;
  cv: number | null;
  personalBest: number | null;
  hitRate14: number | null;
  trend: SkillSummary["trend"];
  trendSlopePct: number | null;
  difficultyHint: SkillSummary["difficultyHint"];
  /** Meta / PB em %. */
  consistencyRatio: number | null;
}

export function computedMetricsFromSkill(skill: SkillSummary | null): ComputedMetrics {
  if (!skill) {
    return {
      skill: null,
      nextTarget: null,
      nextStretch: null,
      mu: null,
      sigma: null,
      cv: null,
      personalBest: null,
      hitRate14: null,
      trend: "insufficient",
      trendSlopePct: null,
      difficultyHint: null,
      consistencyRatio: null,
    };
  }
  const ratio =
    skill.nextTarget !== null && skill.pb !== null && skill.pb > 0
      ? Number(((skill.nextTarget / skill.pb) * 100).toFixed(1))
      : null;
  return {
    skill,
    nextTarget: skill.nextTarget,
    nextStretch: skill.nextStretch,
    mu: skill.mu,
    sigma: skill.sigma,
    cv: skill.cv,
    personalBest: skill.pb,
    hitRate14: skill.hitRate14,
    trend: skill.trend,
    trendSlopePct: skill.trendSlopePct,
    difficultyHint: skill.difficultyHint,
    consistencyRatio: ratio,
  };
}

export function computeMetricDeltas(sessions: TrainingSessionSummary[]): MetricDeltas {
  if (sessions.length < 2) return { scoreDelta: null, targetDelta: null };
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const targetDelta =
    last.target !== null && prev.target !== null ? Math.round(last.target - prev.target) : null;
  return { scoreDelta: last.best - prev.best, targetDelta };
}

export function computeTargetProgress(
  currentScore: number | null,
  target: number | null
): TargetProgress | null {
  if (currentScore === null || target === null || target <= 0) return null;
  const diff = currentScore - target;
  return {
    achieved: diff >= 0,
    diff,
    percentage: Math.round((currentScore / target) * 100),
  };
}

/** Melhor score de cada sessão de treino (para sparkline), as últimas `limit`. */
export function extractRecentTrend(sessions: TrainingSessionSummary[], limit: number = 6): number[] {
  if (sessions.length === 0) return [];
  return sessions.slice(-limit).map((s) => s.best);
}

/** Arredonda um score para exibição: inteiro a partir de 100, uma casa abaixo disso. */
export function roundScore(v: number): number {
  return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
}
