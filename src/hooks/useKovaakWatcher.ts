import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { ImportStats, RunRecordedEvent, WatcherStatus } from "@/lib/types";
import {
  detectKovaakPath,
  getSettings,
  getWatcherStatus,
  importExistingCsvs,
  onImportComplete,
  onRunRecorded,
  onWatcherError,
  setStatsPath,
  startWatcher,
  stopWatcher,
} from "@/lib/tauri-bridge";
import { dataStore } from "@/lib/data-store";
import { deriveTask } from "@/lib/derived-tasks";
import { getTargetThresholdForTask } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatBackendError } from "@/lib/backend-error";
import { useApp } from "./useAppData";
import { useSettings } from "./useSettings";

export interface WatcherContextValue {
  watcherStatus: WatcherStatus;
  settingsPath: string | null;
  toggleWatcher: () => Promise<void>;
  reimportCsvs: () => Promise<ImportStats>;
  updateStatsPath: (path: string) => Promise<void>;
  detectKovaakPath: () => Promise<string | null>;
}

const WatcherContext = createContext<WatcherContextValue | null>(null);

/**
 * Um único watcher para o app inteiro (antes `useKovaakWatcher()` era chamado em
 * `App.tsx` e em `TrackerWorkspaceContext.tsx`, processando toda run duas vezes).
 * Deve ser montado UMA vez, dentro de `AppProvider`. Quem precisa dele usa `useWatcher()`.
 *
 * O Rust grava a run (`add_run`) e emite `app_data_changed` + `run_recorded`; aqui o
 * `run_recorded` só dispara toast, notificação e o sync do runner.
 */
export function WatcherProvider({ children }: { children: ReactNode }) {
  const { showToast, playlistRunner, fixupTaskCategories } = useApp();
  const { t } = useI18n();
  const { updateSettings } = useSettings();
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus>({
    active: false,
    path: null,
    error: null,
  });
  const [settingsPath, setSettingsPath] = useState<string | null>(null);

  // Handlers de listeners registrados uma vez: leem sempre o valor mais recente via ref.
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;
  const playlistRunnerRef = useRef(playlistRunner);
  playlistRunnerRef.current = playlistRunner;
  const fixupRef = useRef(fixupTaskCategories);
  fixupRef.current = fixupTaskCategories;

  // Listeners (padrão anti-vazamento: cancelado antes do listen() resolver => desfaz).
  useEffect(() => {
    let cancelled = false;
    const unlistens: Array<() => void> = [];
    const track = (pending: Promise<() => void>) => {
      void pending.then((fn) => {
        if (cancelled) fn();
        else unlistens.push(fn);
      });
    };

    track(
      onRunRecorded(async (event: RunRecordedEvent) => {
        // O snapshot com a run chega por `app_data_changed`; espera a revisão para ler o threshold.
        await dataStore.waitForRevision(event.revision);
        if (cancelled) return;

        const rawTask = dataStore.getSnapshot().data.tasks.find((task) => task.id === event.taskId);
        const threshold = rawTask ? getTargetThresholdForTask(deriveTask(rawTask)) : null;

        showToastRef.current(
          tRef.current("toast.newRun", { score: event.score, threshold: threshold ?? "--" }),
          "success"
        );

        playlistRunnerRef.current.syncWithDetectedScenario(event.scenario);
        if (event.isNewTask) void fixupRef.current();

        try {
          let granted = await isPermissionGranted();
          if (!granted) {
            const perm = await requestPermission();
            granted = perm === "granted";
          }
          if (granted) {
            sendNotification({
              title: tRef.current("notif.newRunTitle"),
              body: tRef.current("notif.newRunBody", {
                score: event.score,
                scenario: event.scenario,
              }),
            });
          }
        } catch {}
      })
    );

    track(
      onWatcherError((error) => {
        setWatcherStatus((prev) => ({ ...prev, error, active: false }));
        showToastRef.current(tRef.current("toast.watcherError", { error: formatBackendError(error, tRef.current) }), "error");
      })
    );

    track(
      onImportComplete((stats: ImportStats) => {
        void fixupRef.current();
        showToastRef.current(
          tRef.current("toast.importSummary", { n: stats.new, skipped: stats.skipped }),
          "info"
        );
      })
    );

    return () => {
      cancelled = true;
      unlistens.forEach((un) => un());
    };
  }, []);

  // Inicialização do watcher / import da primeira execução: UMA vez por abertura do app
  // (a guarda em ref sobrevive ao remount do StrictMode).
  const setupStarted = useRef(false);
  useEffect(() => {
    if (setupStarted.current) return;
    setupStarted.current = true;

    const setup = async () => {
      const settings = await getSettings();
      setSettingsPath(settings.kovaak_stats_path);

      if (!settings.kovaak_stats_path) {
        const detected = await detectKovaakPath();
        if (detected) {
          await setStatsPath(detected);
          setSettingsPath(detected);
          await updateSettings({ kovaak_stats_path: detected });
        }
      }

      const status = await getWatcherStatus();
      setWatcherStatus(status);

      if (!status.active && settings.kovaak_stats_path) {
        try {
          await startWatcher();
          setWatcherStatus(await getWatcherStatus());
        } catch {}
      }

      if (settings.import_on_first_run && settings.kovaak_stats_path) {
        try {
          const stats = await importExistingCsvs();
          if (stats.new > 0) {
            showToastRef.current(
              tRef.current("toast.importedFirstRun", { n: stats.new, total: stats.total }),
              "success"
            );
          }
          await updateSettings({ import_on_first_run: false });
        } catch {}
      }
    };

    void setup().catch((err) => console.error("Erro ao iniciar o watcher:", err));
  }, []);

  const toggleWatcher = useCallback(async () => {
    if (watcherStatus.active) {
      await stopWatcher();
    } else {
      await startWatcher();
    }
    setWatcherStatus(await getWatcherStatus());
  }, [watcherStatus.active]);

  const reimportCsvs = useCallback(async () => {
    return importExistingCsvs();
  }, []);

  const updateStatsPath = useCallback(
    async (path: string) => {
      await setStatsPath(path);
      await updateSettings({ kovaak_stats_path: path });
      setSettingsPath(path);
      await startWatcher();
      setWatcherStatus(await getWatcherStatus());
    },
    [updateSettings]
  );

  const value = useMemo<WatcherContextValue>(
    () => ({
      watcherStatus,
      settingsPath,
      toggleWatcher,
      reimportCsvs,
      updateStatsPath,
      detectKovaakPath,
    }),
    [watcherStatus, settingsPath, toggleWatcher, reimportCsvs, updateStatsPath]
  );

  return createElement(WatcherContext.Provider, { value }, children);
}

export function useWatcher(): WatcherContextValue {
  const ctx = useContext(WatcherContext);
  if (!ctx) throw new Error("useWatcher must be used within WatcherProvider");
  return ctx;
}
