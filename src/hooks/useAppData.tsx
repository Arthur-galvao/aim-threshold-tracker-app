import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AppData,
  Playlist,
  PlaylistItem,
  Task,
  ToastState,
  DetectedPlaylistEvent,
} from "@/lib/types";
import { save } from "@tauri-apps/plugin-dialog";
import { SAMPLE_DATA } from "@/lib/sample-data";
import * as bridge from "@/lib/tauri-bridge";
import {
  getPlaylistInProgress,
  listenKovaakPlaylistActive,
} from "@/lib/tauri-bridge";
import { dataStore, type DataStoreBackend } from "@/lib/data-store";
import { createTaskDeriver } from "@/lib/derived-tasks";
import { formatBackendError } from "@/lib/backend-error";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { migrateAndCategorizeTasks } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import { usePlaylistRunner, type PlaylistRunnerState } from "./usePlaylistRunner";
import { useSettings } from "./useSettings";

const APP_NOTIFICATION_TITLE = "Aim Threshold Tracker";

const storeBackend: DataStoreBackend = {
  getAppData: bridge.getAppData,
  onAppDataChanged: bridge.onAppDataChanged,
};

/**
 * Playlist detectada no jogo: procura no snapshot atual; se não existir, sincroniza as
 * playlists de jogo e procura de novo no snapshot DEPOIS da revisão do próprio comando.
 */
async function findDetectedPlaylist(event: DetectedPlaylistEvent): Promise<Playlist | null> {
  const wanted = event.playlist_name.trim().toLowerCase();
  const find = () =>
    dataStore.getSnapshot().data.playlists.find((p) => p.name.trim().toLowerCase() === wanted) ??
    null;
  const found = find();
  if (found) return found;
  const res = await bridge.syncGamePlaylistsCommand(event);
  await dataStore.waitForRevision(res.revision);
  return find();
}

interface AppContextValue {
  /** Snapshot do Rust com thresholds legados derivados (memoizados por task). */
  appData: AppData;
  activeTask: Task | null;
  toast: ToastState;
  showToast: (message: string, type?: ToastState["type"]) => void;
  setActiveTaskId: (id: string) => void;
  /** Corrige categoria/nome de tasks pelo catálogo (só envia `update_task_meta` do que mudou). */
  fixupTaskCategories: () => Promise<void>;
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
  syncGamePlaylists: (manual?: boolean) => Promise<{ imported: number; total: number }>;
  playlistRunner: PlaylistRunnerState;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const snapshot = useSyncExternalStore(dataStore.subscribe, dataStore.getSnapshot);
  const loaded = snapshot.revision >= 0;
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

  // Fonte única: get_app_data + app_data_changed (listener sem vazamento em StrictMode,
  // garantido pelo DataStore: init/dispose usam um contador de geração).
  useEffect(() => {
    dataStore.init(storeBackend).catch((err) => {
      console.error("Erro ao carregar dados do app:", err);
    });
    return () => dataStore.dispose();
  }, []);

  // Derivados: thresholds legados recalculados em CÓPIAS, memoizados por task.
  const deriverRef = useRef(createTaskDeriver());
  const appData = useMemo<AppData>(
    () => ({
      activeTaskId: snapshot.data.activeTaskId,
      tasks: deriverRef.current(snapshot.data.tasks),
      playlists: snapshot.data.playlists ?? [],
    }),
    [snapshot]
  );

  const activeTask = useMemo(
    () => appData.tasks.find((task) => task.id === appData.activeTaskId) ?? null,
    [appData]
  );

  /** Mostra um erro de comando (códigos curtos do backend, traduzidos aqui). */
  const reportError = useCallback(
    (err: unknown) => {
      console.error("Erro no comando do backend:", err);
      showToast(formatBackendError(err, t), "error");
    },
    [showToast, t]
  );

  const fixupTaskCategories = useCallback(async () => {
    const current = dataStore.getSnapshot().data.tasks;
    // migrateAndCategorizeTasks muta; roda em cópias leves (sem sessões).
    const work: Task[] = current.map((task) => ({
      id: task.id,
      name: task.name,
      category: task.category,
      subcategory: task.subcategory,
      sessions: [],
    }));
    migrateAndCategorizeTasks(work);
    for (let i = 0; i < current.length; i++) {
      const before = current[i];
      const after = work[i];
      const patch: { name?: string; category?: string; subcategory?: string } = {};
      if (after.name !== before.name) patch.name = after.name;
      if (after.category !== before.category) patch.category = after.category;
      if (after.subcategory !== before.subcategory) patch.subcategory = after.subcategory;
      if (Object.keys(patch).length === 0) continue;
      try {
        await bridge.updateTaskMeta(before.id, patch);
      } catch (err) {
        console.error("Erro ao recategorizar task:", err);
      }
    }
  }, []);

  const syncGamePlaylists = useCallback(
    async (manual: boolean = false): Promise<{ imported: number; total: number }> => {
      try {
        let imported = 0;
        let total = 0;
        const res = await bridge.syncGamePlaylistsCommand();
        await dataStore.waitForRevision(res.revision);
        imported = res.imported;
        total = res.total;
        // Tasks novas criadas pelo Rust nascem na categoria padrão: recategoriza.
        if (imported > 0) await fixupTaskCategories();

        if (imported > 0) {
          showToast(t("toast.gamePlaylistsImported", { n: imported }), "success");
        } else if (manual) {
          showToast(t("toast.noNewGamePlaylists"), "info");
        }
        return { imported, total };
      } catch (err) {
        console.error("Erro ao sincronizar playlists do KovaaK:", err);
        return { imported: 0, total: 0 };
      }
    },
    [showToast, t, fixupTaskCategories]
  );

  // Ajustes de uma vez por abertura do app, depois do primeiro snapshot.
  const startupDone = useRef(false);
  useEffect(() => {
    if (!loaded || startupDone.current) return;
    startupDone.current = true;
    void fixupTaskCategories().then(() => syncGamePlaylists(false));
  }, [loaded, fixupTaskCategories, syncGamePlaylists]);

  const setActiveTaskId = useCallback(
    (id: string) => {
      if (dataStore.getSnapshot().data.activeTaskId === id) return;
      bridge.setActiveTask(id).catch(reportError);
    },
    [reportError]
  );

  const sendNotificationHelper = useCallback(async (title: string, body: string) => {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (granted) {
        sendNotification({ title, body });
      }
    } catch (err) {
      console.error("Erro ao enviar notificacao:", err);
    }
  }, []);

  // Ajustes vêm do SettingsContext (recarregados no foco da janela, ver useSettings).
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const globalAutoAdvance = settings?.auto_advance_on_threshold !== false;

  const playlistRunner = usePlaylistRunner({
    tasks: appData.tasks,
    setActiveTaskId,
    globalAutoAdvance,
    onStepAdvance: async (_stepIndex, scenarioName, isFinished) => {
      try {
        if (settingsRef.current?.notify_step_advance !== false) {
          if (isFinished) {
            await sendNotificationHelper(APP_NOTIFICATION_TITLE, t("notif.playlistDone"));
          } else if (scenarioName) {
            await sendNotificationHelper(
              APP_NOTIFICATION_TITLE,
              t("notif.stepAdvanced", { name: scenarioName })
            );
          }
        }
      } catch (err) {
        console.error("Erro ao enviar notificacao de avanco de etapa:", err);
      }
    },
  });

  const appDataRef = useRef(appData);
  appDataRef.current = appData;

  const playlistRunnerRef = useRef(playlistRunner);
  playlistRunnerRef.current = playlistRunner;

  const handleDetectedPlaylist = useCallback(
    async (event: DetectedPlaylistEvent) => {
      try {
        const settings = settingsRef.current;
        if (settings?.auto_detect_playlist === false) {
          return;
        }

        const eventPlaylistName = event.playlist_name.trim();
        if (!eventPlaylistName) return;

        // Procura no snapshot ATUAL; se não existir, sincroniza com o jogo e lê o snapshot
        // retornado (ver findDetectedPlaylist).
        const targetPlaylist = await findDetectedPlaylist(event);

        if (!targetPlaylist) return;

        const runner = playlistRunnerRef.current;
        const isSamePlaylistRunning =
          runner.isRunning &&
          runner.activePlaylist &&
          runner.activePlaylist.name.trim().toLowerCase() === targetPlaylist.name.trim().toLowerCase();

        if (!isSamePlaylistRunning) {
          runner.start(targetPlaylist);
          if (settings?.notify_step_advance !== false) {
            await sendNotificationHelper(
              APP_NOTIFICATION_TITLE,
              t("notif.playlistDetected", { name: targetPlaylist.name })
            );
          }
        } else {
          const currentItem = runner.currentItem;
          const currentTaskName = currentItem
            ? appDataRef.current.tasks.find((t) => t.id === currentItem.taskId)?.name
            : undefined;
          const detectedScenarioName =
            (event as any).scenario_name ||
            (event as any).scenarioName ||
            currentTaskName ||
            (event.scenario_list[0] ? event.scenario_list[0].scenario_name : "");

          if (detectedScenarioName) {
            runner.syncWithDetectedScenario(detectedScenarioName, targetPlaylist.name);
          }
        }
      } catch (err) {
        console.error("Erro ao sincronizar playlist ativa do KovaaK:", err);
      }
    },
    [sendNotificationHelper, t]
  );

  useEffect(() => {
    let cancelled = false;
    let un: (() => void) | undefined;

    listenKovaakPlaylistActive((event: DetectedPlaylistEvent) => {
      if (cancelled) return;
      void handleDetectedPlaylist(event);
    }).then((fn) => {
      if (cancelled) fn();
      else un = fn;
    });

    void getPlaylistInProgress()
      .then((initialPip) => {
        if (!cancelled && initialPip && initialPip.playlist_name) {
          void handleDetectedPlaylist(initialPip);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      un?.();
    };
  }, [handleDetectedPlaylist]);

  const loadDemoData = useCallback(async () => {
    try {
      await bridge.replaceAllData(SAMPLE_DATA, "demo");
      showToast(t("toast.demoLoaded"), "success");
    } catch (err) {
      reportError(err);
    }
  }, [showToast, reportError, t]);

  const clearAllData = useCallback(async () => {
    try {
      await bridge.replaceAllData({ activeTaskId: null, tasks: [], playlists: [] }, "clear");
      showToast(t("toast.dataCleared"), "info");
    } catch (err) {
      reportError(err);
    }
  }, [showToast, reportError, t]);

  const exportData = useCallback(() => {
    const fileName = `aim_thresholds_backup_${new Date().toISOString().split("T")[0]}.json`;
    const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (!inTauri) {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(appData, null, 2));
      const anchor = document.createElement("a");
      anchor.href = dataStr;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      showToast(t("toast.exported"), "success");
      return;
    }

    void (async () => {
      try {
        const path = await save({
          defaultPath: fileName,
          title: t("dialog.exportTitle"),
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!path) return;
        await bridge.exportAppData(path);
        showToast(t("toast.exported"), "success");
      } catch (err) {
        reportError(err);
      }
    })();
  }, [appData, showToast, reportError, t]);

  const importData = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        await bridge.importJsonBackup(text);
        showToast(t("toast.imported"), "success");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const createTask = useCallback(
    async (name: string, category: string, subcategory: string) => {
      try {
        await bridge.createTask(name, category, subcategory);
        showToast(t("toast.taskCreated", { name: name.trim() }), "success");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const deleteCurrentTask = useCallback(async () => {
    const activeId = dataStore.getSnapshot().data.activeTaskId;
    if (!activeId) return;
    try {
      await bridge.deleteTask(activeId);
      showToast(t("toast.taskRemoved"), "info");
    } catch (err) {
      reportError(err);
    }
  }, [showToast, reportError, t]);

  const addManualSessions = useCallback(
    async (date: string, sens: number, scores: number[]) => {
      const activeId = dataStore.getSnapshot().data.activeTaskId;
      if (!activeId) {
        showToast(t("toast.selectTask"), "error");
        return;
      }
      try {
        await bridge.addManualSessions(activeId, date, sens, scores);
        showToast(t("toast.sessionsAdded", { n: scores.length }), "success");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const activeId = dataStore.getSnapshot().data.activeTaskId;
      if (!activeId) return;
      try {
        await bridge.deleteSession(activeId, sessionId);
        showToast(t("toast.sessionDeleted"), "info");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const createPlaylist = useCallback(
    async (name: string, items: PlaylistItem[] = []): Promise<Playlist> => {
      const draft: Playlist = {
        id: "", // o Rust gera o id
        name: name.trim(),
        items,
        createdAt: "",
      };
      try {
        const res = await bridge.upsertPlaylist(draft);
        await dataStore.waitForRevision(res.revision);
        const created =
          dataStore.getSnapshot().data.playlists.find((p) => p.id === res.playlistId) ?? {
            ...draft,
            id: res.playlistId,
          };
        showToast(t("toast.playlistCreated", { name: created.name }), "success");
        return created;
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [showToast, reportError, t]
  );

  const updatePlaylist = useCallback(
    async (playlist: Playlist) => {
      try {
        // Edição pelo usuário: a playlist deixa de ser gerenciada pelo sync dos jogos.
        await bridge.upsertPlaylist({ ...playlist, source: "user" });
        showToast(t("toast.playlistUpdated"), "success");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      try {
        await bridge.deletePlaylist(id);
        showToast(t("toast.playlistDeleted"), "info");
      } catch (err) {
        reportError(err);
      }
    },
    [showToast, reportError, t]
  );

  const value: AppContextValue = {
    appData,
    activeTask,
    toast,
    showToast,
    setActiveTaskId,
    fixupTaskCategories,
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
    syncGamePlaylists,
    playlistRunner,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
