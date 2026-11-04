import type { Task } from "./types.ts";
import { recalculateAllTaskThresholds } from "./threshold.ts";

/**
 * Derivados do snapshot (Plano 02 / decisão 8): `Session.threshold` não é mais escrito
 * pelo front nem pelo Rust (chega 0). Até o Plano 04, recalculamos o threshold legado
 * numa CÓPIA da task e memoizamos POR TASK: uma mudança em uma task só recomputa ela.
 */

export type TaskRecalc = (task: Task) => void;

/** Chave de cache: id + metadados + nº de sessões + id da última + soma dos scores. */
export function taskSignature(task: Task): string {
  const sessions = task.sessions ?? [];
  const last = sessions.length > 0 ? sessions[sessions.length - 1].id : "";
  let sum = 0;
  for (const s of sessions) sum += Number(s.pb) || 0;
  return [task.id, task.name, task.category, task.subcategory, sessions.length, last, sum].join("\u0001");
}

export function deriveTask(task: Task, recalc: TaskRecalc = recalculateAllTaskThresholds): Task {
  const derived: Task = { ...task, sessions: (task.sessions ?? []).map((s) => ({ ...s })) };
  recalc(derived);
  return derived;
}

export interface TaskDeriver {
  (tasks: Task[]): Task[];
  /** Quantas tasks foram recomputadas desde a criação (para testes). */
  readonly computeCount: () => number;
}

/**
 * Devolve uma função `tasks -> tasks derivadas`. Tasks inalteradas reaproveitam a MESMA
 * referência; se nenhuma mudou, devolve o mesmo array da chamada anterior.
 */
export function createTaskDeriver(recalc: TaskRecalc = recalculateAllTaskThresholds): TaskDeriver {
  let cache = new Map<string, { signature: string; derived: Task }>();
  let lastResult: Task[] = [];
  let computed = 0;

  const derive = (tasks: Task[]): Task[] => {
    const next = new Map<string, { signature: string; derived: Task }>();
    const result = tasks.map((task) => {
      const signature = taskSignature(task);
      const hit = cache.get(task.id);
      if (hit && hit.signature === signature) {
        next.set(task.id, hit);
        return hit.derived;
      }
      computed += 1;
      const entry = { signature, derived: deriveTask(task, recalc) };
      next.set(task.id, entry);
      return entry.derived;
    });
    cache = next;
    const same =
      result.length === lastResult.length && result.every((task, i) => task === lastResult[i]);
    if (!same) lastResult = result;
    return lastResult;
  };

  return Object.assign(derive, { computeCount: () => computed });
}
