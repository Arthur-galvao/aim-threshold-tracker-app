import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Task, WatcherStatus } from "@/lib/types";
import { useApp } from "@/hooks/useAppData";
import { useKovaakWatcher } from "@/hooks/useKovaakWatcher";
import {
  computeDayThreshold,
  computeTaskMetrics,
  getTargetThresholdForTask,
} from "@/lib/threshold";
import { getStoredTheme, applyTheme, type AppTheme } from "@/lib/theme";

export type RatchetStatus = "ratchet_up" | "plateau_held" | "initial";

export interface ComputedMetrics {
  currentThreshold: number | null;
  dailyTarget: number | null;
  personalBest: number | null;
  consistencyRatio: number | null;
  movingAverage3: number[];
  ratchetStatus: RatchetStatus;
}

export interface SimulatedOutcome {
  willRaiseRatchet: boolean;
  projectedThreshold: number | null;
  thresholdDelta: number;
  willBreakPB: boolean;
  status: RatchetStatus;
}

export interface TrackerWorkspaceState {
  tasks: Task[];
  activeCategory: string;
  activeTask: Task | null;
  computedMetrics: ComputedMetrics;
  watcherStatus: WatcherStatus;
  theme: AppTheme;
}

export interface TrackerWorkspaceActions {
  selectCategory: (category: string) => void;
  selectTask: (taskId: string) => void;
  recordSession: (
    runs: number[],
    sensitivityCm360?: number,
    fov?: number,
    notes?: string
  ) => Promise<void>;
  createTask: (
    name: string,
    category: string,
    subcategory: string,
    targetMetric?: string
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleWatcher: () => Promise<void>;
  setKovaakStatsPath: (path: string) => Promise<void>;
  importBackupJson: (file: File) => Promise<void>;
  exportBackupJson: () => void;
  toggleTheme: () => void;
}

export interface TrackerWorkspaceMeta {
  draftRuns: number[];
  setDraftRuns: (runs: number[]) => void;
  simulatedOutcome: SimulatedOutcome;
}

export interface TrackerWorkspaceContextValue {
  state: TrackerWorkspaceState;
  actions: TrackerWorkspaceActions;
  meta: TrackerWorkspaceMeta;
}

const TrackerWorkspaceContext = createContext<TrackerWorkspaceContextValue | null>(null);

export function TrackerWorkspaceProvider({ children }: { children: ReactNode }) {
  const {
    appData,
    activeTask,
    setActiveTaskId,
    createTask: appCreateTask,
    deleteCurrentTask,
    addManualSessions,
    deleteSession: appDeleteSession,
    importData,
    exportData,
  } = useApp();

  const {
    watcherStatus,
    toggleWatcher: appToggleWatcher,
    updateStatsPath,
  } = useKovaakWatcher();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [draftRuns, setDraftRuns] = useState<number[]>([]);
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const cycle: Record<AppTheme, AppTheme> = {
        "cyber-lab": "tactical-emerald",
        "tactical-emerald": "amethyst-purple",
        "amethyst-purple": "obsidian-amber",
        "obsidian-amber": "cyber-lab",
      };
      const next = cycle[prev] ?? "cyber-lab";
      applyTheme(next);
      return next;
    });
  }, []);

  const selectCategory = useCallback((category: string) => {
    setActiveCategory(category);
  }, []);

  const selectTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
  }, [setActiveTaskId]);

  const recordSession = useCallback(
    async (
      runs: number[],
      sensitivityCm360?: number,
      _fov?: number,
      _notes?: string
    ) => {
      if (runs.length === 0) return;
      const todayIso = new Date().toISOString().slice(0, 10);
      const sens = sensitivityCm360 ?? activeTask?.sessions?.slice(-1)[0]?.sens ?? 35;
      await addManualSessions(todayIso, sens, runs);
      setDraftRuns([]);
    },
    [activeTask, addManualSessions]
  );

  const createTask = useCallback(
    async (name: string, category: string, subcategory: string) => {
      await appCreateTask(name, category, subcategory);
    },
    [appCreateTask]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await appDeleteSession(sessionId);
    },
    [appDeleteSession]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (activeTask?.id === taskId) {
        await deleteCurrentTask();
      }
    },
    [activeTask?.id, deleteCurrentTask]
  );

  const toggleWatcher = useCallback(async () => {
    await appToggleWatcher();
  }, [appToggleWatcher]);

  const setKovaakStatsPath = useCallback(
    async (path: string) => {
      await updateStatsPath(path);
    },
    [updateStatsPath]
  );

  const importBackupJson = useCallback(
    async (file: File) => {
      await importData(file);
    },
    [importData]
  );

  const exportBackupJson = useCallback(() => {
    exportData();
  }, [exportData]);

  // Computed metrics calculation
  const computedMetrics = useMemo<ComputedMetrics>(() => {
    if (!activeTask || !activeTask.sessions || activeTask.sessions.length === 0) {
      return {
        currentThreshold: null,
        dailyTarget: null,
        personalBest: null,
        consistencyRatio: null,
        movingAverage3: [],
        ratchetStatus: "initial",
      };
    }

    const sortedSessions = [...activeTask.sessions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const metrics = computeTaskMetrics(activeTask);
    const currentThreshold = getTargetThresholdForTask(activeTask);
    const personalBest = metrics.maxPB;

    const consistencyRatio =
      personalBest && currentThreshold
        ? Number(((currentThreshold / personalBest) * 100).toFixed(1))
        : null;

    // Moving average of 3 sessions
    const movingAverage3: number[] = [];
    for (let i = 0; i < sortedSessions.length; i++) {
      const sliceStart = Math.max(0, i - 2);
      const window = sortedSessions.slice(sliceStart, i + 1);
      const avg =
        window.reduce((sum, s) => sum + (Number(s.pb) || 0), 0) / window.length;
      movingAverage3.push(Number(avg.toFixed(1)));
    }

    // Ratchet status
    let ratchetStatus: RatchetStatus = "initial";
    if (sortedSessions.length >= 2) {
      const last = sortedSessions[sortedSessions.length - 1];
      const prev = sortedSessions[sortedSessions.length - 2];
      if (last.threshold > prev.threshold) {
        ratchetStatus = "ratchet_up";
      } else {
        ratchetStatus = "plateau_held";
      }
    }

    return {
      currentThreshold,
      dailyTarget: currentThreshold,
      personalBest,
      consistencyRatio,
      movingAverage3,
      ratchetStatus,
    };
  }, [activeTask]);

  // Live simulation of ratchet outcome as user drafts runs
  const simulatedOutcome = useMemo<SimulatedOutcome>(() => {
    const currentThreshold = computedMetrics.currentThreshold;
    const personalBest = computedMetrics.personalBest;

    if (draftRuns.length === 0) {
      return {
        willRaiseRatchet: false,
        projectedThreshold: currentThreshold,
        thresholdDelta: 0,
        willBreakPB: false,
        status: "initial",
      };
    }

    const projectedThreshold = computeDayThreshold(currentThreshold, draftRuns);
    const willRaiseRatchet =
      currentThreshold === null ? true : projectedThreshold > currentThreshold;
    const thresholdDelta =
      currentThreshold === null
        ? projectedThreshold
        : projectedThreshold - currentThreshold;
    const willBreakPB =
      personalBest === null
        ? true
        : draftRuns.some((r) => r > personalBest);
    const status: RatchetStatus = willRaiseRatchet
      ? "ratchet_up"
      : "plateau_held";

    return {
      willRaiseRatchet,
      projectedThreshold,
      thresholdDelta,
      willBreakPB,
      status,
    };
  }, [computedMetrics.currentThreshold, computedMetrics.personalBest, draftRuns]);

  const state: TrackerWorkspaceState = useMemo(
    () => ({
      tasks: appData.tasks,
      activeCategory,
      activeTask,
      computedMetrics,
      watcherStatus,
      theme,
    }),
    [appData.tasks, activeCategory, activeTask, computedMetrics, watcherStatus, theme]
  );

  const actions: TrackerWorkspaceActions = useMemo(
    () => ({
      selectCategory,
      selectTask,
      recordSession,
      createTask,
      deleteSession,
      deleteTask,
      toggleWatcher,
      setKovaakStatsPath,
      importBackupJson,
      exportBackupJson,
      toggleTheme,
    }),
    [
      selectCategory,
      selectTask,
      recordSession,
      createTask,
      deleteSession,
      deleteTask,
      toggleWatcher,
      setKovaakStatsPath,
      importBackupJson,
      exportBackupJson,
      toggleTheme,
    ]
  );

  const meta: TrackerWorkspaceMeta = useMemo(
    () => ({
      draftRuns,
      setDraftRuns,
      simulatedOutcome,
    }),
    [draftRuns, simulatedOutcome]
  );

  const value = useMemo(
    () => ({ state, actions, meta }),
    [state, actions, meta]
  );

  return (
    <TrackerWorkspaceContext.Provider value={value}>
      {children}
    </TrackerWorkspaceContext.Provider>
  );
}

export function useTrackerWorkspace(): TrackerWorkspaceContextValue {
  const context = useContext(TrackerWorkspaceContext);
  if (!context) {
    throw new Error(
      "useTrackerWorkspace must be used within a TrackerWorkspaceProvider"
    );
  }
  return context;
}
