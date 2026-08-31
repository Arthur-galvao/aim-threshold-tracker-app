import type { AppData, Task } from "./types";
import { categorizeScenario } from "./viscose";
import { recalculateAllTaskThresholds } from "./threshold";

export const SAMPLE_DATA: AppData = {
  activeTaskId: "task_1",
  tasks: [
    {
      id: "task_1",
      name: "1w2ts Pasu Perfected",
      category: "Flick Tech",
      subcategory: "Speed",
      sessions: [
        { id: "1_1", date: "2026-10-18", sens: 45, pb: 970, threshold: 920 },
        { id: "1_2", date: "2026-10-18", sens: 45, pb: 1000, threshold: 920 },
        { id: "2_1", date: "2026-10-19", sens: 45, pb: 1020, threshold: 970 },
        { id: "2_2", date: "2026-10-19", sens: 45, pb: 1050, threshold: 970 },
        { id: "3_1", date: "2026-10-22", sens: 45, pb: 1060, threshold: 990 },
        { id: "4_1", date: "2026-10-25", sens: 45, pb: 1080, threshold: 1005 },
        { id: "5_1", date: "2026-10-28", sens: 45, pb: 1110, threshold: 1020 },
      ],
    },
    {
      id: "task_2",
      name: "WALLHACK - VBRClick Easy",
      category: "Flick Tech",
      subcategory: "Stability",
      sessions: [
        { id: "1_1", date: "2026-10-20", sens: 55, pb: 880, threshold: 840 },
        { id: "1_2", date: "2026-10-20", sens: 55, pb: 920, threshold: 840 },
        { id: "2_1", date: "2026-10-21", sens: 55, pb: 980, threshold: 910 },
        { id: "3_1", date: "2026-10-24", sens: 55, pb: 1015, threshold: 940 },
      ],
    },
  ],
};

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

  const newSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    sens,
    pb: score,
    threshold: 0,
    sourceFile,
  };

  task.sessions.push(newSession);
  recalculateAllTaskThresholds(task);

  if (isNew || data.activeTaskId === null) {
    data.activeTaskId = task.id;
  }

  return { task, isNew };
}

export function cloneAppData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data));
}
