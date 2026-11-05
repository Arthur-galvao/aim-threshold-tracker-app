import type { Task } from "../types.ts";
import { groupTrainingSessions, sessionKey, type RunRef } from "./sessions.ts";
import { clamp, invNormCdf, median, robustSigma, theilSenSlope } from "./stats.ts";
import { fitSensAdjust, type SensAdjustModel } from "./sens-adjust.ts";
import { classifyRun, DEFAULT_VALIDITY, type InvalidReason, type RunValidity, type ValidityConfig } from "./validity.ts";

/**
 * Modelo de habilidade e meta móvel (Threshold v2, T4.5).
 * Tudo internamente em y = ln(score). Convenções de escala:
 * - `SkillPoint.muBefore/muAfter/sigma`: log-score.
 * - `SkillPoint.target/stretch`, `SkillSummary.mu/nextTarget/nextStretch/pb`: escala de score.
 * - `SkillSummary.sigma` e `cv`: log-score (σ em log ≈ coeficiente de variação relativo).
 * - `SkillSummary.trendSlopePct`: variação de μ por sessão em % (slope de log × 100).
 */
export interface TargetConfig {
  plannedRuns: number; // 5
  successProb: number; // 0.6; fácil 0.75, difícil 0.45
  rustK: number; // 1
  rustFullDays: number; // 14
}

export interface SkillPoint {
  sessionKey: string;
  startedAt: number;
  nValid: number;
  sessionValue: number | null;
  muBefore: number;
  sigma: number;
  target: number;
  stretch: number;
  hit: boolean | null;
  muAfter: number;
}

export interface SkillRunInfo {
  sessionId: string;
  t: number;
  score: number;
  sens: number;
  validity: RunValidity;
  /** Chave da sessão de treino (global) à qual a run pertence — casa com `SkillPoint.sessionKey`. */
  sessionKey: string;
}

export interface SkillSummary {
  points: SkillPoint[];
  mu: number | null;
  sigma: number | null;
  cv: number | null;
  nextTarget: number | null;
  nextStretch: number | null;
  pb: number | null;
  hitRate14: number | null;
  trend: "up" | "flat" | "down" | "insufficient";
  trendSlopePct: number | null;
  difficultyHint: "too_easy" | "too_hard" | null;
  model: SensAdjustModel;
  runs: SkillRunInfo[];
  invalidCounts: Partial<Record<InvalidReason, number>>;
}

export const DEFAULT_TARGET: TargetConfig = {
  plannedRuns: 5,
  successProb: 0.6,
  rustK: 1,
  rustFullDays: 14,
};

export function successProbFor(difficulty: "easy" | "normal" | "hard"): number {
  return difficulty === "easy" ? 0.75 : difficulty === "hard" ? 0.45 : 0.6;
}

const DAY_MS = 86_400_000;
const SIGMA_PRIOR = 0.06;
const SIGMA_PRIOR_WEIGHT = 10;
const SIGMA_MIN = 0.015;
const SIGMA_MAX = 0.25;
const RESIDUAL_WINDOW = 60;

/** σ a partir dos resíduos intra-sessão acumulados (encolhido para o prior com poucos dados). */
function estimateSigma(residuals: number[]): number {
  const c = residuals.length;
  const sigmaHat = c >= 2 ? robustSigma(residuals) : 0;
  const blended = c >= SIGMA_PRIOR_WEIGHT ? sigmaHat : (c * sigmaHat + (SIGMA_PRIOR_WEIGHT - c) * SIGMA_PRIOR) / SIGMA_PRIOR_WEIGHT;
  return clamp(blended, SIGMA_MIN, SIGMA_MAX);
}

/** Meta (score) e stretch a partir de μ, σ e dias parado (ferrugem). */
function targetFrom(mu: number, sigma: number, gapDays: number, tc: TargetConfig): { target: number; stretch: number } {
  const rust = tc.rustK * sigma * Math.min(1, Math.max(0, gapDays) / tc.rustFullDays);
  const muEff = mu - rust;
  const planned = Math.max(1, tc.plannedRuns);
  const q = 1 - Math.pow(1 - tc.successProb, 1 / planned);
  return {
    target: Math.exp(muEff + sigma * invNormCdf(1 - q)),
    stretch: Math.exp(muEff + 2 * sigma),
  };
}

export function computeSkill(
  task: Task,
  allRuns: RunRef[],
  cfg: { validity?: ValidityConfig; target?: TargetConfig; gapMinutes?: number },
  now: number,
): SkillSummary {
  const validityCfg = cfg.validity ?? DEFAULT_VALIDITY;
  const targetCfg = cfg.target ?? DEFAULT_TARGET;
  const taskRuns = allRuns.filter((r) => r.taskId === task.id);
  const groups = groupTrainingSessions(allRuns, cfg.gapMinutes ?? 45);
  const model = fitSensAdjust(taskRuns, groups);

  const runs: SkillRunInfo[] = [];
  const invalidCounts: Partial<Record<InvalidReason, number>> = {};
  const points: SkillPoint[] = [];
  let pb: number | null = null;
  for (const r of taskRuns) if (r.session.pb > 0 && (pb === null || r.session.pb > pb)) pb = r.session.pb;

  let mu: number | null = null;
  let updates = 0;
  let residuals: number[] = [];
  let lastT: number | null = null;
  let totalValid = 0;

  for (const group of groups) {
    const scen = group.filter((r) => r.taskId === task.id);
    if (scen.length === 0) continue;
    const key = sessionKey(group);
    const startedAt = group[0].t;

    const items: Array<{ y: number; w: number }> = [];
    for (const run of scen) {
      const validity = classifyRun(run, { sessionGroup: group, scenarioRunsInSession: scen, model, cfg: validityCfg });
      runs.push({ sessionId: run.session.id, t: run.t, score: run.session.pb, sens: run.session.sens, validity, sessionKey: key });
      if (validity.valid) items.push({ y: validity.y, w: validity.weight });
      else if (validity.reason) invalidCounts[validity.reason] = (invalidCounts[validity.reason] ?? 0) + 1;
    }

    // 1. valor da sessão
    const n = items.length;
    totalValid += n;
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const k = Math.min(3, n);
    const top = sorted.slice(0, k);
    const s = n > 0 ? median(top.map((i) => i.y)) : null;
    const wS = n > 0 ? (top.reduce((acc, i) => acc + i.w, 0) / k) * Math.min(1, n / 3) : 0;

    const gapDays = lastT === null ? 0 : Math.max(0, (startedAt - lastT) / DAY_MS);
    const lastRunT = Math.max(...scen.map((r) => r.t));

    if (s === null) {
      // sem válidas: não atualiza μ; só gera ponto se já existe μ
      if (mu !== null) {
        const sigma = estimateSigma(residuals);
        const { target, stretch } = targetFrom(mu, sigma, gapDays, targetCfg);
        points.push({ sessionKey: key, startedAt, nValid: 0, sessionValue: null, muBefore: mu, sigma, target, stretch, hit: null, muAfter: mu });
      }
      lastT = lastT === null ? lastRunT : Math.max(lastT, lastRunT);
      continue;
    }

    // 2. σ rolante (só runs anteriores) e 3-4. meta antes da sessão
    const sigma = estimateSigma(residuals);
    const first = mu === null;
    const muBefore = first ? s : mu!;
    const { target, stretch } = targetFrom(muBefore, sigma, gapDays, targetCfg);

    // 5. hit
    const hit = first ? null : Math.max(...items.map((i) => i.y)) >= Math.log(target);

    // 6. atualização
    let muAfter: number;
    if (first) {
      muAfter = s;
    } else {
      const alpha = (updates < 5 ? 0.3 : 0.18) * wS;
      const sClamped = clamp(s, muBefore - 2.5 * sigma, muBefore + 2.5 * sigma);
      muAfter = muBefore + alpha * (sClamped - muBefore);
    }
    mu = muAfter;
    updates++;

    points.push({ sessionKey: key, startedAt, nValid: n, sessionValue: s, muBefore, sigma, target, stretch, hit, muAfter });

    // resíduos intra-sessão para σ das próximas sessões
    if (n >= 2) {
      const mean = items.reduce((acc, i) => acc + i.y, 0) / n;
      residuals = residuals.concat(items.map((i) => i.y - mean)).slice(-RESIDUAL_WINDOW);
    }
    lastT = lastT === null ? lastRunT : Math.max(lastT, lastRunT);
  }

  // 7. próxima meta
  let sigmaNow: number | null = null;
  let nextTarget: number | null = null;
  let nextStretch: number | null = null;
  if (mu !== null) {
    sigmaNow = estimateSigma(residuals);
    const gapDays = lastT === null ? 0 : Math.max(0, (now - lastT) / DAY_MS);
    const t = targetFrom(mu, sigmaNow, gapDays, targetCfg);
    nextTarget = t.target;
    nextStretch = t.stretch;
  }

  // 9. hit rate das últimas 14 sessões com hit definido
  const hits = points.filter((p) => p.hit !== null).slice(-14);
  const hitCount = hits.filter((p) => p.hit === true).length;
  const hitRate14 = hits.length > 0 ? hitCount / hits.length : null;
  let difficultyHint: SkillSummary["difficultyHint"] = null;
  if (hitRate14 !== null && hits.length >= 6) {
    if (hitRate14 > 0.75) difficultyHint = "too_easy";
    else if (hitRate14 < 0.35) difficultyHint = "too_hard";
  }

  // 10. tendência
  let trend: SkillSummary["trend"] = "insufficient";
  let trendSlopePct: number | null = null;
  const valued = points.filter((p) => p.sessionValue !== null).slice(-10);
  if (valued.length >= 8 && totalValid >= 30) {
    const slope = theilSenSlope(valued.map((_, i) => i), valued.map((p) => p.muAfter));
    trendSlopePct = slope * 100;
    trend = slope > 0.002 ? "up" : slope < -0.004 ? "down" : "flat";
  }

  return {
    points,
    mu: mu === null ? null : Math.exp(mu),
    sigma: sigmaNow,
    cv: sigmaNow,
    nextTarget,
    nextStretch,
    pb,
    hitRate14,
    trend,
    trendSlopePct,
    difficultyHint,
    model,
    runs,
    invalidCounts,
  };
}
