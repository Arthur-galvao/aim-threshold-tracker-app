import type { Task } from "./types.ts";

/**
 * Derivados do snapshot. No Threshold v2 `Session.threshold` não é mais recalculado:
 * a meta vem de `computeSkill` (hook `useSkill`). Por padrão o deriver é uma passagem direta
 * que preserva as referências (task e array) — as tasks do snapshot já são imutáveis.
 *
 * Um `recalc` explícito (opcional) ativa a derivação por task: recalcula numa CÓPIA da
 * task, memoizado POR TASK.
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

export function deriveTask(task: Task, recalc?: TaskRecalc): Task {
  if (!recalc) return task;
  const derived: Task = { ...task, sessions: (task.sessions ?? []).map((s) => ({ ...s })) };
  recalc(derived);
  return derived;
}

export interface TaskDeriver {
  (tasks: Task[]): Task[];
  /** Quantas tasks foram recomputadas (com `recalc`) desde a criação (para testes). */
  readonly computeCount: () => number;
}

/**
 * Devolve uma função `tasks -> tasks derivadas`. Sem `recalc`, devolve o próprio array.
 * Com `recalc`, tasks inalteradas reaproveitam a MESMA referência derivada.
 */
export function createTaskDeriver(recalc?: TaskRecalc): TaskDeriver {
  if (!recalc) {
    return Object.assign((tasks: Task[]): Task[] => tasks, { computeCount: () => 0 });
  }

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
