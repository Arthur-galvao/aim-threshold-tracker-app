import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/hooks/useAppData";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_TRAINING_SETTINGS, type Task, type TrainingSettings } from "@/lib/types";
import { computeSkill, type SkillSummary } from "@/lib/skill";
import { buildAllRuns, skillConfigFromTraining, type SkillConfig } from "@/lib/skill/config";
import type { RunRef } from "@/lib/skill/sessions";

/** Acima deste número de tasks, `useAllSkills` calcula em tempo ocioso. */
const IDLE_THRESHOLD_TASKS = 200;
/** Acima deste tempo (ms) o cálculo é registrado no console (T8.11). */
const SLOW_MS = 50;

const allRunsCache = new WeakMap<Task[], RunRef[]>();

/** Runs globais, memoizadas por identidade do array de tasks (que muda a cada revision). */
function runsFor(tasks: Task[]): RunRef[] {
  let runs = allRunsCache.get(tasks);
  if (!runs) {
    runs = buildAllRuns(tasks);
    allRunsCache.set(tasks, runs);
  }
  return runs;
}

function timed<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const out = fn();
  const ms = performance.now() - start;
  if (ms > SLOW_MS) console.debug(`[skill] ${label} levou ${ms.toFixed(1)} ms`);
  return out;
}

function skillsFor(
  tasks: Task[],
  allRuns: RunRef[],
  cfg: SkillConfig,
): Map<string, SkillSummary> {
  return timed(`computeAllSkills(${tasks.length} tasks)`, () => {
    const now = Date.now();
    const out = new Map<string, SkillSummary>();
    for (const task of tasks) out.set(task.id, computeSkill(task, allRuns, cfg, now));
    return out;
  });
}

/** Todas as runs globais (sessões são agrupadas globalmente, não por cenário). */
export function useAllRuns(): RunRef[] {
  const { appData } = useApp();
  return useMemo(() => runsFor(appData.tasks), [appData.tasks]);
}

/** Habilidade/meta de um task. `null` sem taskId ou se o task não existe. */
export function useSkill(taskId: string | null | undefined): SkillSummary | null {
  const { appData } = useApp();
  const { settings } = useSettings();
  const training: TrainingSettings = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const tasks = appData.tasks;
  const allRuns = useAllRuns();

  return useMemo(() => {
    if (!taskId) return null;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const cfg = skillConfigFromTraining(training);
    return timed(`computeSkill(${task.id})`, () => computeSkill(task, allRuns, cfg, Date.now()));
  }, [taskId, tasks, allRuns, training]);
}

type IdleHandle = { kind: "idle"; id: number } | { kind: "timeout"; id: ReturnType<typeof setTimeout> };

function scheduleIdle(fn: () => void): IdleHandle {
  if (typeof requestIdleCallback === "function") {
    return { kind: "idle", id: requestIdleCallback(() => fn()) };
  }
  return { kind: "timeout", id: setTimeout(fn, 0) };
}

function cancelIdle(h: IdleHandle) {
  if (h.kind === "idle") {
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(h.id);
  } else {
    clearTimeout(h.id);
  }
}

/**
 * Habilidade de todos os tasks (breakdown/weakness), memoizada por revision.
 * Com mais de 200 tasks, o cálculo roda em tempo ocioso e o hook devolve o último resultado
 * (vazio até o primeiro cálculo terminar).
 */
export function useAllSkills(): Map<string, SkillSummary> {
  const { appData } = useApp();
  const { settings } = useSettings();
  const training: TrainingSettings = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const tasks = appData.tasks;
  const allRuns = useAllRuns();
  const cfg = useMemo(() => skillConfigFromTraining(training), [training]);

  const isLarge = tasks.length > IDLE_THRESHOLD_TASKS;

  const syncResult = useMemo(
    () => (isLarge ? null : skillsFor(tasks, allRuns, cfg)),
    [isLarge, tasks, allRuns, cfg],
  );

  const [idleResult, setIdleResult] = useState<Map<string, SkillSummary>>(() => new Map());

  useEffect(() => {
    if (!isLarge) return;
    let cancelled = false;
    const handle = scheduleIdle(() => {
      if (cancelled) return;
      setIdleResult(skillsFor(tasks, allRuns, cfg));
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, [isLarge, tasks, allRuns, cfg]);

  return syncResult ?? idleResult;
}
