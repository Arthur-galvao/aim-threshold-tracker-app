import type { RunRef } from "./sessions.ts";
import { adjustLogScore, type SensAdjustModel } from "./sens-adjust.ts";

export interface ValidityConfig {
  /** Runs de aquecimento no início da SESSÃO (todos os cenários). Nome mantido por compatibilidade. */
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

function sameRun(a: RunRef, b: RunRef): boolean {
  return a === b || (a.session.id === b.session.id && a.taskId === b.taskId);
}

/**
 * Aquecimento é da SESSÃO de treino (todos os cenários), não de cada cenário:
 * - as primeiras `warmupRunsPerScenario` runs da sessão (o nome do campo ficou por compatibilidade), ou
 * - runs iniciadas nos primeiros `sessionWarmupMinutes` da sessão (quando há datetime).
 * Se essas regras marcariam TODAS as runs da sessão como aquecimento (ex.: uma run isolada no dia),
 * nenhuma é descartada — senão a sessão inteira some da meta e quem joga pouco nunca calibra.
 */
function isSessionWarmup(run: RunRef, group: RunRef[], cfg: ValidityConfig): boolean {
  const ordered = group.length > 0 ? [...group].sort((a, b) => a.t - b.t) : [run];
  const start = ordered[0].t;
  const windowMs = cfg.sessionWarmupMinutes * 60_000;
  const inWindow = (r: RunRef, idx: number) =>
    idx < cfg.warmupRunsPerScenario || (!!r.session.datetime && r.t - start < windowMs);

  const idx = ordered.findIndex((r) => sameRun(r, run));
  if (idx < 0 || !inWindow(run, idx)) return false;
  // Há pelo menos uma run fora do aquecimento? Só então esta é descartada.
  return ordered.some((r, i) => !inWindow(r, i));
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
  if (isSessionWarmup(run, ctx.sessionGroup, ctx.cfg)) return invalid("warmup", y);
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
