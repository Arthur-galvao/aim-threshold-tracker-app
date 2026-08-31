import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppData, Task, ToastState } from "@/lib/types";
import { cloneAppData, SAMPLE_DATA } from "@/lib/sample-data";
import {
  loadAppData,
  saveAppData,
  importJsonBackup,
} from "@/lib/tauri-bridge";
import {
  recalculateAllTaskThresholds,
  recalculateAllTasks,
} from "@/lib/threshold";
import { migrateAndCategorizeTasks } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

interface AppContextValue {
  appData: AppData;
  activeTask: Task | null;
  toast: ToastState;
  showToast: (message: string, type?: ToastState["type"]) => void;
  setActiveTaskId: (id: string) => void;
  refreshData: () => Promise<void>;
  saveData: (data: AppData) => Promise<void>;
  updateAppData: (updater: (prev: AppData) => AppData) => Promise<void>;
  loadDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  createTask: (name: string, category: string, subcategory: string) => Promise<void>;
  deleteCurrentTask: () => Promise<void>;
  addManualSessions: (date: string, sens: number, scores: number[]) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [appData, setAppData] = useState<AppData>({ activeTaskId: null, tasks: [] });
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "info",
    visible: false,
  });

  const showToast = useCallback(
    (message: string, type: ToastState["type"] = "info") => {
      setToast({ message, type, visible: true });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 2800);
    },
    []
  );

  const refreshData = useCallback(async () => {
    const data = await loadAppData();
    recalculateAllTasks(data.tasks);
    const recategorized = migrateAndCategorizeTasks(data.tasks);
    setAppData(data);
    if (recategorized) {
      void saveAppData(data);
    }
  }, []);

  const saveData = useCallback(async (data: AppData) => {
    recalculateAllTasks(data.tasks);
    await saveAppData(data);
    setAppData(cloneAppData(data));
  }, []);

  const updateAppData = useCallback(
    async (updater: (prev: AppData) => AppData) => {
      setAppData((prev) => {
        const next = cloneAppData(updater(prev));
        recalculateAllTasks(next.tasks);
        void saveAppData(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const activeTask = useMemo(
    () => appData.tasks.find((t) => t.id === appData.activeTaskId) ?? null,
    [appData]
  );

  const setActiveTaskId = useCallback(
    (id: string) => {
      void updateAppData((prev) => ({ ...prev, activeTaskId: id }));
    },
    [updateAppData]
  );

  const loadDemoData = useCallback(async () => {
    await saveData(cloneAppData(SAMPLE_DATA));
    showToast(t("toast.demoLoaded"), "success");
  }, [saveData, showToast, t]);

  const clearAllData = useCallback(async () => {
    await updateAppData(() => ({ activeTaskId: null, tasks: [] }));
    showToast(t("toast.dataCleared"), "info");
  }, [updateAppData, showToast, t]);

  const exportData = useCallback(() => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(appData, null, 2));
    const anchor = document.createElement("a");
    anchor.href = dataStr;
    anchor.download = `aim_thresholds_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast(t("toast.exported"), "success");
  }, [appData, showToast, t]);

  const importData = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = await importJsonBackup(text);
      recalculateAllTasks(parsed.tasks);
      setAppData(parsed);
      showToast(t("toast.imported"), "success");
    },
    [showToast, t]
  );

  const createTask = useCallback(
    async (name: string, category: string, subcategory: string) => {
      const newTask: Task = {
        id: `task_${Date.now()}`,
        name: name.trim(),
        category,
        subcategory,
        sessions: [],
      };
      await updateAppData((prev) => ({
        ...prev,
        tasks: [...prev.tasks, newTask],
        activeTaskId: newTask.id,
      }));
      showToast(t("toast.taskCreated", { name: newTask.name }), "success");
    },
    [updateAppData, showToast, t]
  );

  const deleteCurrentTask = useCallback(async () => {
    if (!appData.activeTaskId) return;
    await updateAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== prev.activeTaskId),
      activeTaskId:
        prev.tasks.filter((t) => t.id !== prev.activeTaskId)[0]?.id ?? null,
    }));
    showToast(t("toast.taskRemoved"), "info");
  }, [appData.activeTaskId, updateAppData, showToast, t]);

  const addManualSessions = useCallback(
    async (date: string, sens: number, scores: number[]) => {
      if (!appData.activeTaskId) {
        showToast(t("toast.selectTask"), "error");
        return;
      }
      await updateAppData((prev) => {
        const next = cloneAppData(prev);
        const task = next.tasks.find((t) => t.id === next.activeTaskId);
        if (!task) return prev;

        scores.forEach((score, index) => {
          task.sessions.push({
            id: `sess_${Date.now()}_${index}`,
            date,
            sens,
            pb: score,
            threshold: 0,
          });
        });
        recalculateAllTaskThresholds(task);
        return next;
      });
      showToast(t("toast.sessionsAdded", { n: scores.length }), "success");
    },
    [appData.activeTaskId, updateAppData, showToast, t]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!appData.activeTaskId) return;
      await updateAppData((prev) => {
        const next = cloneAppData(prev);
        const task = next.tasks.find((t) => t.id === next.activeTaskId);
        if (!task) return prev;
        task.sessions = task.sessions.filter((s) => s.id !== sessionId);
        recalculateAllTaskThresholds(task);
        return next;
      });
      showToast(t("toast.sessionDeleted"), "info");
    },
    [appData.activeTaskId, updateAppData, showToast, t]
  );

  const value: AppContextValue = {
    appData,
    activeTask,
    toast,
    showToast,
    setActiveTaskId,
    refreshData,
    saveData,
    updateAppData,
    loadDemoData,
    clearAllData,
    exportData,
    importData,
    createTask,
    deleteCurrentTask,
    addManualSessions,
    deleteSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
