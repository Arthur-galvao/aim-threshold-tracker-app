import type { RunRef } from "./sessions.ts";
import { adjustLogScore, type SensAdjustModel } from "./sens-adjust.ts";

export interface ValidityConfig {
  warmupRunsPerScenario: number; // 1
  sessionWarmupMinutes: number; // 5
  maxPauseSeconds: number; // 10
  baseBandRatio: number; // 1.05
}

export type InvalidReason = "warmup" | "paused" | "no_score" | "off_center_unadjustable" | "manual_excluded";

export interface RunValidity {
  valid: boolean;
  weight: number;
  reason?: InvalidReason;
  /** ln(score), possivelmente ajustado por sens. NaN quando não há score (no_score). */
  y: number;
}

export const DEFAULT_VALIDITY: ValidityConfig = {
  warmupRunsPerScenario: 1,
  sessionWarmupMinutes: 5,
  maxPauseSeconds: 10,
  baseBandRatio: 1.05,
};

export interface ClassifyContext {
  /** Sessão de treino global (todos os cenários) que contém a run. */
  sessionGroup: RunRef[];
  /** Runs do mesmo cenário dentro dessa sessão, em ordem. */
  scenarioRunsInSession: RunRef[];
  model: SensAdjustModel;
  cfg: ValidityConfig;
}

function invalid(reason: InvalidReason, y: number): RunValidity {
  return { valid: false, weight: 0, reason, y };
}

function rawY(run: RunRef): number {
  return run.session.pb > 0 ? Math.log(run.session.pb) : Number.NaN;
}

function indexInScenario(run: RunRef, list: RunRef[]): number {
  const byRef = list.indexOf(run);
  if (byRef >= 0) return byRef;
  const byId = list.findIndex((r) => r.session.id === run.session.id && r.taskId === run.taskId);
  return byId >= 0 ? byId : 0;
}

/**
 * Regras 1–3 (no_score, paused, warmup). Reutilizável pelo Laboratório.
 * Devolve a invalidez ou `null` se a run passa nas três.
 */
export function classifyBasic(
  run: RunRef,
  ctx: Pick<ClassifyContext, "sessionGroup" | "scenarioRunsInSession" | "cfg">,
): RunValidity | null {
  const { session } = run;
  const y = rawY(run);
  if (!(session.pb > 0)) return invalid("no_score", y);
  if ((session.pauseDuration ?? 0) > ctx.cfg.maxPauseSeconds) return invalid("paused", y);

  if (indexInScenario(run, ctx.scenarioRunsInSession) < ctx.cfg.warmupRunsPerScenario) {
    return invalid("warmup", y);
  }
  if (session.datetime && ctx.sessionGroup.length > 0) {
    let start = Infinity;
    for (const r of ctx.sessionGroup) if (r.t < start) start = r.t;
    if (run.t - start < ctx.cfg.sessionWarmupMinutes * 60_000) return invalid("warmup", y);
  }
  return null;
}

export function classifyRun(run: RunRef, ctx: ClassifyContext): RunValidity {
  const basic = classifyBasic(run, ctx);
  if (basic) return basic;

  const { session } = run;
  const y = rawY(run);
  const role = session.sensRole ?? "unknown";
  const center = session.rollCenterCm ?? ctx.model.centerFallback;
  const delta = session.sens > 0 && center > 0 ? Math.log(session.sens / center) : 0;
  const measureBoost = session.runMode === "measure" ? 1.25 : 1;

  if (role === "base" || role === "anchor" || role === "off" || Math.abs(delta) <= Math.log(ctx.cfg.baseBandRatio)) {
    return { valid: true, weight: Math.min(1.25, 1 * measureBoost), y };
  }
  if (ctx.model.reliable) {
    return {
      valid: true,
      weight: Math.min(1.25, 0.6 * measureBoost),
      y: adjustLogScore(y, session.sens, center, ctx.model),
    };
  }
  return invalid("off_center_unadjustable", y);
}
