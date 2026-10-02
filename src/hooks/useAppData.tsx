import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, Playlist, PlaylistItem, Task, ToastState, DetectedPlaylistEvent } from "@/lib/types";
import { cloneAppData, SAMPLE_DATA } from "@/lib/sample-data";
import {
  loadAppData,
  saveAppData,
  importJsonBackup,
  getKovaakPlaylists,
  getPlaylistInProgress,
  listenKovaakPlaylistActive,
  getSettings,
} from "@/lib/tauri-bridge";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  recalculateAllTaskThresholds,
  recalculateAllTasks,
} from "@/lib/threshold";
import { categorizeScenario, migrateAndCategorizeTasks } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import { usePlaylistRunner, type PlaylistRunnerState } from "./usePlaylistRunner";

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
  createPlaylist: (name: string, items?: PlaylistItem[]) => Promise<Playlist>;
  updatePlaylist: (playlist: Playlist) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  syncKovaakPlaylists: (manual?: boolean) => Promise<{ imported: number; total: number }>;
  playlistRunner: PlaylistRunnerState;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [appData, setAppData] = useState<AppData>({ activeTaskId: null, tasks: [], playlists: [] });
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
    if (!data.playlists) data.playlists = [];
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

  const syncKovaakPlaylists = useCallback(
    async (manual: boolean = false): Promise<{ imported: number; total: number }> => {
      try {
        const rawPlaylists = await getKovaakPlaylists();
        if (!rawPlaylists || rawPlaylists.length === 0) {
          if (manual) {
            showToast(t("toast.noNewKovaakPlaylists"), "info");
          }
          return { imported: 0, total: 0 };
        }

        let importedCount = 0;

        await updateAppData((prev) => {
          const currentPlaylists = prev.playlists ?? [];
          const existingNames = new Set(
            currentPlaylists.map((p) => p.name.trim().toLowerCase())
          );

          const updatedTasks = [...prev.tasks];
          const newPlaylists: Playlist[] = [];

          for (const kpl of rawPlaylists) {
            const cleanName = kpl.playlistName.trim();
            if (!cleanName || existingNames.has(cleanName.toLowerCase())) {
              continue;
            }

            const items: PlaylistItem[] = [];

            for (let idx = 0; idx < kpl.scenarioList.length; idx++) {
              const item = kpl.scenarioList[idx];
              const scenarioName = item.scenarioName.trim();
              if (!scenarioName) continue;

              let task = updatedTasks.find(
                (t) => t.name.trim().toLowerCase() === scenarioName.toLowerCase()
              );

              if (!task) {
                const { category, subcategory } = categorizeScenario(scenarioName);
                task = {
                  id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name: scenarioName,
                  category,
                  subcategory,
                  sessions: [],
                };
                updatedTasks.push(task);
              }

              items.push({
                id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                taskId: task.id,
                targetMode: "reps",
                targetValue: Math.max(1, Math.round(item.playCount || 1)),
              });
            }

            if (items.length > 0) {
              const newPl: Playlist = {
                id: `pl_${Date.now()}_${newPlaylists.length}`,
                name: cleanName,
                items,
                createdAt: new Date().toISOString(),
              };
              newPlaylists.push(newPl);
              existingNames.add(cleanName.toLowerCase());
              importedCount++;
            }
          }

          if (importedCount === 0) {
            return prev;
          }

          return {
            ...prev,
            tasks: updatedTasks,
            playlists: [...currentPlaylists, ...newPlaylists],
            activeTaskId: prev.activeTaskId ?? (updatedTasks[0]?.id ?? null),
          };
        });

        if (importedCount > 0) {
          showToast(t("toast.kovaakPlaylistsImported", { n: importedCount }), "success");
        } else if (manual) {
          showToast(t("toast.noNewKovaakPlaylists"), "info");
        }

        return { imported: importedCount, total: rawPlaylists.length };
      } catch (err) {
        console.error("Erro ao sincronizar playlists do KovaaK:", err);
        return { imported: 0, total: 0 };
      }
    },
    [updateAppData, showToast, t]
  );

  const initialSyncDone = useRef(false);

  useEffect(() => {
    void refreshData().then(() => {
      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        void syncKovaakPlaylists(false);
      }
    });
  }, [refreshData, syncKovaakPlaylists]);

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

  const playlistRunner = usePlaylistRunner({
    tasks: appData.tasks,
    setActiveTaskId,
  });

  const appDataRef = useRef(appData);
  appDataRef.current = appData;

  const playlistRunnerRef = useRef(playlistRunner);
  playlistRunnerRef.current = playlistRunner;

  const handleDetectedPlaylist = useCallback(
    async (event: DetectedPlaylistEvent) => {
      try {
        const settings = await getSettings();
        if (settings.auto_detect_playlist === false) {
          return;
        }

        const eventPlaylistName = event.playlist_name.trim();
        if (!eventPlaylistName) return;

        let targetPlaylist: Playlist | null =
          (appDataRef.current.playlists || []).find(
            (p) => p.name.trim().toLowerCase() === eventPlaylistName.toLowerCase()
          ) ?? null;

        if (!targetPlaylist && event.scenario_list && event.scenario_list.length > 0) {
          await updateAppData((prev) => {
            const currentPlaylists = prev.playlists ?? [];
            const existing = currentPlaylists.find(
              (p) => p.name.trim().toLowerCase() === eventPlaylistName.toLowerCase()
            );
            if (existing) {
              targetPlaylist = existing;
              return prev;
            }

            const updatedTasks = [...prev.tasks];
            const items: PlaylistItem[] = [];

            for (let idx = 0; idx < event.scenario_list.length; idx++) {
              const sItem = event.scenario_list[idx];
              const scenarioName = sItem.scenario_name.trim();
              if (!scenarioName) continue;

              let task = updatedTasks.find(
                (t) => t.name.trim().toLowerCase() === scenarioName.toLowerCase()
              );
              if (!task) {
                const { category, subcategory } = categorizeScenario(scenarioName);
                task = {
                  id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name: scenarioName,
                  category,
                  subcategory,
                  sessions: [],
                };
                updatedTasks.push(task);
              }

              items.push({
                id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
                taskId: task.id,
                targetMode: "reps",
                targetValue: Math.max(1, Math.round(sItem.play_count || 1)),
              });
            }

            if (items.length === 0) return prev;

            const newPl: Playlist = {
              id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              name: eventPlaylistName,
              items,
              createdAt: new Date().toISOString(),
            };

            targetPlaylist = newPl;

            return {
              ...prev,
              tasks: updatedTasks,
              playlists: [...currentPlaylists, newPl],
              activeTaskId: prev.activeTaskId ?? (updatedTasks[0]?.id ?? null),
            };
          });
        }

        if (!targetPlaylist) return;

        const runner = playlistRunnerRef.current;
        const isSamePlaylistRunning =
          runner.isRunning &&
          runner.activePlaylist &&
          runner.activePlaylist.name.trim().toLowerCase() === targetPlaylist.name.trim().toLowerCase();

        if (isSamePlaylistRunning) {
          const currentItem = runner.currentItem;
          const currentTaskName = currentItem
            ? appDataRef.current.tasks.find((t) => t.id === currentItem.taskId)?.name
            : undefined;
          const detectedScenarioName =
            currentTaskName ||
            (event.scenario_list[0] ? event.scenario_list[0].scenario_name : "");

          if (detectedScenarioName) {
            runner.syncWithDetectedScenario(detectedScenarioName, targetPlaylist.name);
          }
        } else {
          runner.start(targetPlaylist);
        }

        if (settings.notify_step_advance !== false) {
          try {
            let granted = await isPermissionGranted();
            if (!granted) {
              const perm = await requestPermission();
              granted = perm === "granted";
            }
            if (granted) {
              sendNotification({
                title: "Aim Threshold Tracker",
                body: `Playlist detectada: ${targetPlaylist.name}`,
              });
            }
          } catch (notifErr) {
            console.error("Erro ao enviar notificacao:", notifErr);
          }
        }
      } catch (err) {
        console.error("Erro ao sincronizar playlist ativa do KovaaK:", err);
      }
    },
    [updateAppData]
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const setupListeners = async () => {
      unlisten = await listenKovaakPlaylistActive((event: DetectedPlaylistEvent) => {
        if (!isMounted) return;
        void handleDetectedPlaylist(event);
      });

      try {
        const initialPip = await getPlaylistInProgress();
        if (isMounted && initialPip && initialPip.playlist_name) {
          void handleDetectedPlaylist(initialPip);
        }
      } catch {}
    };

    void setupListeners();

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [handleDetectedPlaylist]);

  const loadDemoData = useCallback(async () => {
    await saveData(cloneAppData(SAMPLE_DATA));
    showToast(t("toast.demoLoaded"), "success");
  }, [saveData, showToast, t]);

  const clearAllData = useCallback(async () => {
    await updateAppData(() => ({ activeTaskId: null, tasks: [], playlists: [] }));
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

  const createPlaylist = useCallback(
    async (name: string, items: PlaylistItem[] = []): Promise<Playlist> => {
      const newPlaylist: Playlist = {
        id: `pl_${Date.now()}`,
        name: name.trim(),
        items,
        createdAt: new Date().toISOString(),
      };
      await updateAppData((prev) => ({
        ...prev,
        playlists: [...(prev.playlists ?? []), newPlaylist],
      }));
      showToast(t("toast.playlistCreated", { name: newPlaylist.name }), "success");
      return newPlaylist;
    },
    [updateAppData, showToast, t]
  );

  const updatePlaylist = useCallback(
    async (playlist: Playlist) => {
      await updateAppData((prev) => ({
        ...prev,
        playlists: (prev.playlists ?? []).map((p) =>
          p.id === playlist.id ? playlist : p
        ),
      }));
      showToast(t("toast.playlistUpdated"), "success");
    },
    [updateAppData, showToast, t]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await updateAppData((prev) => ({
        ...prev,
        playlists: (prev.playlists ?? []).filter((p) => p.id !== id),
      }));
      showToast(t("toast.playlistDeleted"), "info");
    },
    [updateAppData, showToast, t]
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
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncKovaakPlaylists,
    playlistRunner,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
