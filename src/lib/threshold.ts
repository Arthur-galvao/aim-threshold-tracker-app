import type { AppData, Task } from "./types";
import { categorizeScenario } from "./viscose";

export function cloneAppData(data: AppData): AppData {
  return typeof structuredClone === "function"
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));
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
  let gIdx = 0;

  for (const entries of dateGroups.values()) {
    const scores = entries.map((e) => Number(e.pb) || 0);
    const dayPB = Math.max(...scores);
    const sortedScores = scores.length > 1 ? [...scores].sort((a, b) => b - a) : null;
    const secondPB = sortedScores ? sortedScores[1] : null;

    let groupThreshold = 0;

    if (gIdx === 0 || prevThreshold === null) {
      groupThreshold = secondPB !== null ? Math.round(secondPB) : Math.round(dayPB * 0.92);
    } else {
      let candidate = Math.round(dayPB * 0.93);
      if (secondPB !== null) {
        candidate = Math.max(candidate, Math.round(secondPB));
      }

      groupThreshold = Math.max(prevThreshold, candidate);

      if (dayPB < groupThreshold) {
        groupThreshold = Math.min(prevThreshold, dayPB);
      }
    }

    for (const entry of entries) {
      entry.threshold = groupThreshold;
    }

    prevThreshold = groupThreshold;
    gIdx++;
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
      const maxInInput = Math.max(...rawScores);
      const firstThreshold =
        rawScores.length > 1
          ? [...rawScores].sort((a, b) => b - a)[1]
          : Math.round(maxInInput * 0.92);
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

  const maxInInput = Math.max(...rawScores);
  let estimatedThreshold = targetThresh;

  if (rawScores.length > 1) {
    const sortedRuns = [...rawScores].sort((a, b) => b - a);
    estimatedThreshold = Math.max(targetThresh, Math.round(sortedRuns[1]));
  } else {
    estimatedThreshold = Math.max(targetThresh, Math.round(maxInInput * 0.93));
  }

  if (maxInInput < estimatedThreshold) {
    estimatedThreshold = Math.min(targetThresh, maxInInput);
  }

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
      consistency: null as string | null,
      lastSens: null as number | null,
    };
  }

  const pbs = task.sessions.map((s) => Number(s.pb) || 0);
  const maxPB = Math.max(...pbs);
  const targetThreshold = getTargetThresholdForTask(task);

  const dateGroups = new Map<string, typeof task.sessions>();
  for (const sess of task.sessions) {
    const list = dateGroups.get(sess.date);
    if (list) {
      list.push(sess);
    } else {
      dateGroups.set(sess.date, [sess]);
    }
  }

  let totalRatio = 0;
  let validDays = 0;
  for (const entries of dateGroups.values()) {
    const scores = entries.map((e) => Number(e.pb) || 0);
    const dayPB = Math.max(...scores);
    const dayThreshold = entries[0].threshold;
    if (dayPB > 0) {
      totalRatio += dayThreshold / dayPB;
      validDays++;
    }
  }

  const consistency =
    validDays > 0 ? ((totalRatio / validDays) * 100).toFixed(1) : "0.0";

  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const lastSession = sorted[sorted.length - 1];

  return {
    maxPB,
    targetThreshold,
    consistency: `${consistency}%`,
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
