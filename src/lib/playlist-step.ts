import {
  DEFAULT_STEP_MAX_ATTEMPTS,
  DEFAULT_STEP_MAX_MINUTES,
  type Playlist,
  type PlaylistItem,
  type Task,
} from "./types.ts";
import { runTime } from "./skill/sessions.ts";
import { targetAtSens, type SensAdjustModel } from "./skill/sens-adjust.ts";

/** Lógica pura dos passos da playlist (Plano 07: T7.5, T7.6, T7.7, T5.7e). Sem React/Tauri. */

/** Lembrete semanal de medição (Voltaic: medir 1×/semana). */
export const MEASURE_REMINDER_DAYS = 7;
/** Limite do cue de intenção por cenário (o Rust também trunca). */
export const MAX_INTENT_CUE_CHARS = 80;
/** Razões de sens/centro para o cue muscular (plano 05). */
export const MUSCLE_CUE_FAST_RATIO = 0.92;
export const MUSCLE_CUE_SLOW_RATIO = 1.08;

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// T7.5: tipo de passo
// ---------------------------------------------------------------------------

/** Passo de medição: item marcado como medição, ou playlist inteira de medição. */
export function isMeasureStep(item: PlaylistItem | null | undefined, playlist: Playlist | null | undefined): boolean {
  if (!item) return false;
  return playlist?.isMeasurement === true || item.stepKind === "measure";
}

/** Playlist de medição: a sessão inteira roda na sens base, sem randomizer. */
export function playlistMeasureDue(playlist: Playlist, tasks: Task[], nowMs: number, days = MEASURE_REMINDER_DAYS): boolean {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  for (const item of playlist.items) {
    if (seen.has(item.taskId)) continue;
    seen.add(item.taskId);
    const task = taskMap.get(item.taskId);
    if (!task || task.sessions.length === 0) continue;
    const times: number[] = [];
    for (let i = 0; i < task.sessions.length; i++) {
      if (task.sessions[i].runMode === "measure") times.push(runTime(task.sessions[i], i));
    }
    // Cenário nunca medido, ou última medição há mais de `days` dias.
    if (times.length === 0 || nowMs - Math.max(...times) > days * DAY_MS) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// T7.6: tentativas válidas e teto por tentativas/minutos
// ---------------------------------------------------------------------------

export function stepMaxAttempts(item: PlaylistItem): number {
  return item.maxAttempts ?? DEFAULT_STEP_MAX_ATTEMPTS;
}

export function stepMaxMinutes(item: PlaylistItem): number {
  return item.maxMinutes ?? DEFAULT_STEP_MAX_MINUTES;
}

export interface StepRunLike {
  sessionId: string;
  score: number;
  valid: boolean;
}

/** Conta só as runs válidas criadas depois do início do passo (ids de sessão ausentes em `startIds`). */
export function countStepAttempts(
  runs: readonly StepRunLike[],
  startIds: ReadonlySet<string>,
): { validAttempts: number; bestValid: number | null } {
  let validAttempts = 0;
  let bestValid: number | null = null;
  for (const run of runs) {
    if (!run.valid || startIds.has(run.sessionId)) continue;
    validAttempts++;
    if (bestValid === null || run.score > bestValid) bestValid = run.score;
  }
  return { validAttempts, bestValid };
}

export type ThresholdStepOutcome = "pending" | "hit" | "missed";

export interface ThresholdStepInput {
  validAttempts: number;
  bestValid: number | null;
  /** Meta na sens atual; null = ainda sem histórico (basta cumprir `minReps`). */
  target: number | null;
  minReps: number;
  elapsedSeconds: number;
  maxAttempts: number;
  maxMinutes: number;
}

/**
 * Bateu: `minReps` tentativas válidas e melhor válida ≥ meta.
 * Não bateu: teto de tentativas válidas ou de minutos atingido sem bater.
 */
export function evaluateThresholdStep(input: ThresholdStepInput): ThresholdStepOutcome {
  const metTarget =
    input.target === null || (input.bestValid !== null && input.bestValid >= input.target);
  if (input.validAttempts >= Math.max(1, input.minReps) && metTarget) return "hit";
  if (input.validAttempts >= input.maxAttempts) return "missed";
  if (input.elapsedSeconds >= input.maxMinutes * 60) return "missed";
  return "pending";
}

/** Formato "M:SS" usado no contador "Tentativa 3/8 · 4:12/10:00". */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// T5.7e / T4.8h: meta e cue muscular na sens ativa
// ---------------------------------------------------------------------------

export interface StepSensContext {
  sensCm: number;
  centerCm: number;
}

/** Meta do passo na sens ativa (T·exp(b·Δ²)). Sem contexto de randomizer, devolve a meta base. */
export function targetAtSensCtx(
  base: number | null,
  model: SensAdjustModel | null,
  ctx: StepSensContext | null,
): number | null {
  if (base === null) return null;
  if (!ctx || !model || !(ctx.sensCm > 0) || !(ctx.centerCm > 0)) return base;
  return targetAtSens(base, ctx.sensCm, ctx.centerCm, model);
}

/** Cue muscular: sens abaixo do centro = pulso/dedos; acima = braço; senão base. */
export function muscleCueFor(sensCm: number, centerCm: number): "fast" | "slow" | "base" {
  if (!(sensCm > 0) || !(centerCm > 0)) return "base";
  const ratio = sensCm / centerCm;
  if (ratio < MUSCLE_CUE_FAST_RATIO) return "fast";
  if (ratio > MUSCLE_CUE_SLOW_RATIO) return "slow";
  return "base";
}

// ---------------------------------------------------------------------------
// T7.7: cue de intenção por cenário
// ---------------------------------------------------------------------------

/** Trunca em 80 caracteres (por code point) e remove espaços das pontas. */
export function normalizeIntentCue(raw: string): string {
  return Array.from(raw.trim()).slice(0, MAX_INTENT_CUE_CHARS).join("").trimEnd();
}

/** Cue salvo pelo usuário; sem cue salvo, o default (mechanicKey traduzido). */
export function resolveIntentCue(task: Pick<Task, "intentCue">, defaultCue: string): string {
  const custom = task.intentCue?.trim();
  return custom ? custom : defaultCue;
}
