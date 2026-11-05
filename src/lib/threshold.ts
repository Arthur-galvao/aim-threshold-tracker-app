import type { AppData, Task, Playlist } from "./types.ts";
import { DEFAULT_TRAINING_SETTINGS } from "./types.ts";
import { categorizeScenario } from "./viscose.ts";
import { computeSkill, type SkillSummary } from "./skill/index.ts";
import { buildAllRuns, skillConfigFromTraining, type SkillConfig } from "./skill/config.ts";
import { runTime, type RunRef } from "./skill/sessions.ts";

/**
 * Threshold v2: a meta vem de `computeSkill` (src/lib/skill). Este módulo guarda só utilitários
 * de dados (sanitização, criação de task), a simulação de runs digitadas e o formato Escalate.
 * `Session.threshold` NÃO é mais escrito; o campo existe apenas para ler dados antigos.
 */

export function sanitizeAppData(data: AppData): boolean {
  let changed = false;
  const seenTaskIds = new Set<string>();
  const seenSessionIds = new Set<string>();

  for (const task of data.tasks) {
    if (!task.id || seenTaskIds.has(task.id)) {
      task.id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      changed = true;
    }
    seenTaskIds.add(task.id);

    for (const session of task.sessions) {
      if (!session.id || seenSessionIds.has(session.id)) {
        session.id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        changed = true;
      }
      seenSessionIds.add(session.id);
    }
  }

  return changed;
}

export function findTaskByScenario(tasks: Task[], scenario: string): Task | undefined {
  const normalized = scenario.trim().toLowerCase();
  return tasks.find((t) => t.name.trim().toLowerCase() === normalized);
}

export function createTaskFromScenario(scenario: string): Task {
  const { category, subcategory } = categorizeScenario(scenario);
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: scenario.trim(),
    category,
    subcategory,
    sessions: [],
  };
}

/**
 * LEGADO: lê o `threshold` gravado na sessão mais recente (dados antigos; chega 0 em dados novos).
 * Para a meta atual use `SkillSummary.nextTarget` (hook `useSkill`).
 */
export function getTargetThresholdForTask(task: Task | null): number | null {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return null;
  }
  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].threshold;
}

export function parseInputScores(rawInput: string): number[] {
  if (!rawInput) return [];
  return rawInput
    .toString()
    .split(/[\s,;]+/)
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && v > 0);
}

// ---------------------------------------------------------------------------
// Simulação de runs digitadas (lançamento manual)
// ---------------------------------------------------------------------------

export interface SimulatedOutcome {
  /** Próxima meta (escala de score) depois de contabilizar as runs digitadas. */
  projectedTarget: number | null;
  /** Alguma run digitada >= meta que valia antes. */
  willHit: boolean;
  willBreakPB: boolean;
  /** Meta que valia antes (nextTarget atual). */
  targetBefore: number | null;
  /** Quantas das runs digitadas contam para a meta (as demais são aquecimento etc.). */
  validCount: number;
}

export interface DraftInput {
  scores: number[];
  sens: number;
  /** YYYY-MM-DD; as runs manuais não têm horário (são tratadas como um grupo do dia). */
  date: string;
}

/**
 * Roda `computeSkill` com as runs digitadas anexadas e compara com o estado atual.
 * Função pura: `allRuns` deve ser o conjunto global (ver `buildAllRuns`).
 */
export function simulateDraftRuns(
  task: Task | null,
  allRuns: RunRef[],
  draft: DraftInput,
  cfg: SkillConfig,
  now: number,
): SimulatedOutcome {
  if (!task) {
    return { projectedTarget: null, willHit: false, willBreakPB: false, targetBefore: null, validCount: 0 };
  }
  const before = computeSkill(task, allRuns, cfg, now);
  const scores = draft.scores.filter((s) => Number.isFinite(s) && s > 0);
  if (scores.length === 0) {
    return {
      projectedTarget: before.nextTarget,
      willHit: false,
      willBreakPB: false,
      targetBefore: before.nextTarget,
      validCount: 0,
    };
  }

  const base = task.sessions.length;
  const refs: RunRef[] = scores.map((pb, i) => {
    const session = {
      id: `__draft_${i}`,
      date: draft.date,
      sens: draft.sens,
      pb,
      threshold: 0,
      game: "manual" as const,
      sensRole: "unknown" as const,
    };
    return { taskId: task.id, session, t: runTime(session, base + i) };
  });
  const after = computeSkill(task, [...allRuns, ...refs], cfg, now);
  const draftIds = new Set(refs.map((r) => r.session.id));
  const validCount = after.runs.filter((r) => draftIds.has(r.sessionId) && r.validity.valid).length;
  const best = Math.max(...scores);

  return {
    projectedTarget: after.nextTarget,
    willHit: before.nextTarget !== null && best >= before.nextTarget,
    willBreakPB: before.pb === null ? true : best > before.pb,
    targetBefore: before.nextTarget,
    validCount,
  };
}

// ---------------------------------------------------------------------------
// Métricas rápidas e Escalate
// ---------------------------------------------------------------------------

function localSkill(task: Task): SkillSummary {
  const cfg = skillConfigFromTraining(DEFAULT_TRAINING_SETTINGS);
  return computeSkill(task, buildAllRuns([task]), cfg, Date.now());
}

/**
 * Métricas resumidas de um task. Sem `skill`, calcula localmente só com as runs do próprio task
 * (agrupamento de sessões sem os outros cenários); prefira passar o `SkillSummary` de `useSkill`.
 * `hitRate` em % (0-100) das últimas 14 sessões; `targetThreshold` = próxima meta arredondada.
 */
export function computeTaskMetrics(task: Task | null, skill?: SkillSummary | null) {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return {
      maxPB: null as number | null,
      targetThreshold: null as number | null,
      hitRate: null as number | null,
      streak: 0,
      lastSens: null as number | null,
    };
  }

  const sk = skill ?? localSkill(task);
  const hitRate = sk.hitRate14 === null ? null : Number((sk.hitRate14 * 100).toFixed(1));

  let streak = 0;
  for (let i = sk.points.length - 1; i >= 0; i--) {
    const hit = sk.points[i].hit;
    if (hit === null) continue;
    if (hit) streak++;
    else break;
  }

  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  return {
    maxPB: sk.pb,
    targetThreshold: sk.nextTarget === null ? null : Math.round(sk.nextTarget),
    hitRate,
    streak,
    lastSens: sorted[sorted.length - 1].sens,
  };
}

/**
 * Formato Escalate: `PB [meta da sessão] (dd/mm)` por run.
 * A meta é a da sessão de treino da run (v2); runs sem meta (1ª sessão) usam o `threshold`
 * legado se existir, senão saem sem colchetes. FOV e sens vêm da última run (fallback 103).
 */
export function buildEscalateFormat(task: Task, skill?: SkillSummary | null): string | null {
  if (!task.sessions.length) return null;
  const sk = skill ?? localSkill(task);

  const targetByKey = new Map(sk.points.map((p) => [p.sessionKey, p.target]));
  const firstKey = sk.points[0]?.sessionKey ?? null;
  const infoById = new Map(sk.runs.map((r) => [r.sessionId, r]));

  const ordered = task.sessions
    .map((s, i) => ({ s, t: infoById.get(s.id)?.t ?? runTime(s, i), i }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const last = ordered[ordered.length - 1].s;
  const fov = last.fov && last.fov > 0 ? last.fov : 103;

  let textOutput = `${task.name} - ${last.sens}cm ${fov}\n`;

  for (const { s } of ordered) {
    const info = infoById.get(s.id);
    const [, month, day] = s.date.split("-");
    let target: number | null = null;
    if (info && info.sessionKey !== firstKey) target = targetByKey.get(info.sessionKey) ?? null;
    if (target === null && s.threshold > 0) target = s.threshold;
    const bracket = target === null ? "" : ` [${Math.round(target)}]`;
    textOutput += `${s.pb}${bracket} (${day}/${month}) `;
  }

  return textOutput.trim();
}

export function resolveAutoAdvanceOnThreshold(
  playlist: Playlist | null | undefined,
  globalSetting: boolean | undefined
): boolean {
  const overrideVal = playlist?.autoAdvanceMode;
  if (overrideVal === "enabled") return true;
  if (overrideVal === "disabled") return false;
  return globalSetting !== false;
}
