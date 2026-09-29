import type { AppData } from "./types";

export const SAMPLE_DATA: AppData = {
  activeTaskId: "task_1",
  playlists: [],
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

export {
  cloneAppData,
  findTaskByScenario,
  createTaskFromScenario,
  addSessionsFromRun,
} from "./threshold";
