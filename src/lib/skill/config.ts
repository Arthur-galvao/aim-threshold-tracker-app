import type { Task, TrainingSettings } from "../types.ts";
import { runTime, type RunRef } from "./sessions.ts";
import { successProbFor, DEFAULT_TARGET, type TargetConfig } from "./skill-model.ts";
import type { ValidityConfig } from "./validity.ts";

/** Razão da banda de sens "base" (|ln(sens/centro)| ≤ ln(ratio)). Fixa, não é ajuste do usuário. */
export const BASE_BAND_RATIO = 1.05;

export interface SkillConfig {
  validity: ValidityConfig;
  target: TargetConfig;
  gapMinutes: number;
}

/** Converte as preferências de treino (AppSettings.training) na configuração do modelo de habilidade. */
export function skillConfigFromTraining(t: TrainingSettings): SkillConfig {
  return {
    validity: {
      warmupRunsPerScenario: t.warmupRunsPerScenario,
      sessionWarmupMinutes: t.sessionWarmupMinutes,
      maxPauseSeconds: t.maxPauseSeconds,
      baseBandRatio: BASE_BAND_RATIO,
    },
    target: {
      plannedRuns: t.plannedRuns,
      successProb: successProbFor(t.difficulty),
      rustK: DEFAULT_TARGET.rustK,
      rustFullDays: DEFAULT_TARGET.rustFullDays,
    },
    gapMinutes: t.sessionGapMinutes,
  };
}

/** Todas as runs de todos os tasks, com instante calculado pela posição no array `sessions` do task. */
export function buildAllRuns(tasks: Task[]): RunRef[] {
  const out: RunRef[] = [];
  for (const task of tasks) {
    task.sessions.forEach((session, index) => {
      out.push({ taskId: task.id, session, t: runTime(session, index) });
    });
  }
  return out;
}
