import type { AppData, Task, Playlist } from "./types.ts";
import { categorizeScenario } from "./viscose.ts";
import { summarizeDays } from "./day-summary.ts";

export function cloneAppData(data: AppData): AppData {
  return typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));
}

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

export function addSessionsFromRun(
  data: AppData,
  scenario: string,
  date: string,
  sens: number,
  score: number,
  sourceFile?: string
): { task: Task; isNew: boolean } {
  let task = findTaskByScenario(data.tasks, scenario);
  let isNew = false;

  if (!task) {
    task = createTaskFromScenario(scenario);
    data.tasks.push(task);
    isNew = true;
  }

  task.sessions.push({
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    sens,
    pb: score,
    threshold: 0,
    sourceFile,
  });

  recalculateAllTaskThresholds(task);

  if (isNew || data.activeTaskId === null) {
    data.activeTaskId = task.id;
  }

  return { task, isNew };
}

export function getTargetThresholdForTask(task: Task | null): number | null {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return null;
  }
  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].threshold;
}

export function computeDayThreshold(prev: number | null, scores: number[]): number {
  if (!scores || scores.length === 0) return prev ?? 0;
  const numScores = scores.map((s) => Number(s) || 0);
  const dayPB = Math.max(...numScores);
  const sortedScores = numScores.length > 1 ? [...numScores].sort((a, b) => b - a) : null;
  const secondPB = sortedScores ? sortedScores[1] : null;

  if (prev === null) {
    return secondPB !== null ? Math.round(secondPB) : Math.round(dayPB * 0.92);
  }

  let candidate = Math.round(dayPB * 0.93);
  if (secondPB !== null) {
    candidate = Math.max(candidate, Math.round(secondPB));
  }

  return Math.max(prev, candidate);
}

export function recalculateAllTaskThresholds(task: Task): void {
  if (!task.sessions || task.sessions.length === 0) return;

  task.sessions.sort((a, b) => a.date.localeCompare(b.date));

  const dateGroups = new Map<string, typeof task.sessions>();
  for (const sess of task.sessions) {
    const list = dateGroups.get(sess.date);
    if (list) {
      list.push(sess);
    } else {
      dateGroups.set(sess.date, [sess]);
    }
  }

  let prevThreshold: number | null = null;

  for (const entries of dateGroups.values()) {
    const scores = entries.map((e) => Number(e.pb) || 0);
    const groupThreshold = computeDayThreshold(prevThreshold, scores);

    for (const entry of entries) {
      entry.threshold = groupThreshold;
    }

    prevThreshold = groupThreshold;
  }
}

export function parseInputScores(rawInput: string): number[] {
  if (!rawInput) return [];
  return rawInput
    .toString()
    .split(/[\s,;]+/)
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && v > 0);
}

export type SessionDetailKey =
  | "session.detailNoTask"
  | "session.detailFirst"
  | "session.detailTypeScores"
  | "session.detailGoal"
  | "session.detailEvolved"
  | "session.detailMaintained";

export function estimateSessionThreshold(
  task: Task | null,
  rawScores: number[]
): {
  threshold: number | null;
  detailKey: SessionDetailKey;
  detailParams: Record<string, string | number>;
} {
  const targetThresh = task ? getTargetThresholdForTask(task) : null;

  if (!task) {
    return {
      threshold: null,
      detailKey: "session.detailNoTask",
      detailParams: {},
    };
  }

  if (targetThresh === null) {
    if (rawScores.length > 0) {
      const firstThreshold = computeDayThreshold(null, rawScores);
      return {
        threshold: firstThreshold,
        detailKey: "session.detailFirst",
        detailParams: { n: rawScores.length, t: firstThreshold },
      };
    }
    return {
      threshold: null,
      detailKey: "session.detailTypeScores",
      detailParams: {},
    };
  }

  if (rawScores.length === 0) {
    return {
      threshold: targetThresh,
      detailKey: "session.detailGoal",
      detailParams: { t: targetThresh },
    };
  }

  const estimatedThreshold = computeDayThreshold(targetThresh, rawScores);

  return {
    threshold: estimatedThreshold,
    detailKey:
      estimatedThreshold > targetThresh
        ? "session.detailEvolved"
        : "session.detailMaintained",
    detailParams: { t: estimatedThreshold },
  };
}

export function computeTaskMetrics(task: Task | null) {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return {
      maxPB: null as number | null,
      targetThreshold: null as number | null,
      hitRate: null as number | null,
      streak: 0,
      lastSens: null as number | null,
    };
  }

  const pbs = task.sessions.map((s) => Number(s.pb) || 0);
  const maxPB = Math.max(...pbs);
  const targetThreshold = getTargetThresholdForTask(task);

  const summaries = summarizeDays(task);
  const eligibleDays = summaries.filter((d) => d.hit !== null);
  let hitRate: number | null = null;
  if (eligibleDays.length > 0) {
    const hits = eligibleDays.filter((d) => d.hit === true).length;
    hitRate = Number(((hits / eligibleDays.length) * 100).toFixed(1));
  }

  let streak = 0;
  for (let i = summaries.length - 1; i >= 0; i--) {
    if (summaries[i].hit === true) {
      streak++;
    } else {
      break;
    }
  }

  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const lastSession = sorted[sorted.length - 1];

  return {
    maxPB,
    targetThreshold,
    hitRate,
    streak,
    lastSens: lastSession.sens,
  };
}

export function buildEscalateFormat(task: Task): string | null {
  if (!task.sessions.length) return null;

  const sortedSessions = [...task.sessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const lastSession = sortedSessions[sortedSessions.length - 1];

  let textOutput = `${task.name} - ${lastSession.sens}cm 103\n`;

  for (const s of sortedSessions) {
    const [, month, day] = s.date.split("-");
    textOutput += `${s.pb} [${s.threshold}] (${day}/${month}) `;
  }

  return textOutput.trim();
}

export function recalculateAllTasks(tasks: Task[]): void {
  for (const task of tasks) {
    recalculateAllTaskThresholds(task);
  }
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
