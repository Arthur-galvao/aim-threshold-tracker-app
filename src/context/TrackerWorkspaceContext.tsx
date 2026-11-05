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
import { useWatcher } from "@/hooks/useKovaakWatcher";
import { simulateDraftRuns, type SimulatedOutcome } from "@/lib/threshold";
import { computedMetricsFromSkill, type ComputedMetrics } from "@/lib/metric-deltas";
import { skillConfigFromTraining } from "@/lib/skill/config";
import { useSkill, useAllRuns } from "@/hooks/useSkill";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { getStoredTheme, applyTheme, type AppTheme } from "@/lib/theme";

export type { ComputedMetrics, SimulatedOutcome };

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
  } = useWatcher();

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

  // Meta/habilidade derivadas do modelo v2 (computeSkill)
  const skill = useSkill(activeTask?.id ?? null);
  const allRuns = useAllRuns();
  const { settings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;

  const computedMetrics = useMemo<ComputedMetrics>(
    () => computedMetricsFromSkill(skill),
    [skill]
  );

  // Simulação ao vivo das runs digitadas (sens = última sens do cenário, data = hoje)
  const simulatedOutcome = useMemo<SimulatedOutcome>(() => {
    const lastSens = activeTask?.sessions?.slice(-1)[0]?.sens ?? 0;
    return simulateDraftRuns(
      activeTask,
      allRuns,
      { scores: draftRuns, sens: lastSens, date: new Date().toISOString().slice(0, 10) },
      skillConfigFromTraining(training),
      Date.now()
    );
  }, [activeTask, allRuns, draftRuns, training]);

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
