import { useEffect, useRef, useState } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { ImportStats, KovaakRun, WatcherStatus } from "@/lib/types";
import {
  detectKovaakPath,
  getSettings,
  getWatcherStatus,
  importExistingCsvs,
  onImportComplete,
  onNewRun,
  onWatcherError,
  saveSettings,
  setStatsPath,
  startWatcher,
  stopWatcher,
} from "@/lib/tauri-bridge";
import { addSessionsFromRun, cloneAppData } from "@/lib/sample-data";
import { getTargetThresholdForTask } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { useApp } from "./useAppData";

export function useKovaakWatcher() {
  const { appData, saveData, showToast, refreshData } = useApp();
  const { t } = useI18n();
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus>({
    active: false,
    path: null,
    error: null,
  });
  const [settingsPath, setSettingsPath] = useState<string | null>(null);
  const appDataRef = useRef(appData);
  appDataRef.current = appData;

  useEffect(() => {
    let unlistenRun: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenImport: (() => void) | undefined;

    const setup = async () => {
      const settings = await getSettings();
      setSettingsPath(settings.kovaak_stats_path);

      if (!settings.kovaak_stats_path) {
        const detected = await detectKovaakPath();
        if (detected) {
          await setStatsPath(detected);
          setSettingsPath(detected);
          await saveSettings({
            ...settings,
            kovaak_stats_path: detected,
          });
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
            await refreshData();
            showToast(
              t("toast.importedFirstRun", { n: stats.new, total: stats.total }),
              "success"
            );
          }
          await saveSettings({ ...settings, import_on_first_run: false });
        } catch {}
      }

      unlistenRun = await onNewRun(async (run: KovaakRun) => {
        const date = run.datetime.slice(0, 10);
        const next = cloneAppData(appDataRef.current);
        const { task } = addSessionsFromRun(
          next,
          run.scenario,
          date,
          run.sens,
          run.score,
          run.source_file
        );
        await saveData(next);

        const threshold = getTargetThresholdForTask(task);

        showToast(
          t("toast.newRun", { score: run.score, threshold: threshold ?? "--" }),
          "success"
        );

        try {
          let granted = await isPermissionGranted();
          if (!granted) {
            const perm = await requestPermission();
            granted = perm === "granted";
          }
          if (granted) {
            sendNotification({
              title: "Nova Run Registrada",
              body: `Score: ${run.score} | ${run.scenario}`,
            });
          }
        } catch {}
      });

      unlistenError = await onWatcherError((error) => {
        setWatcherStatus((prev) => ({ ...prev, error, active: false }));
        showToast(t("toast.watcherError", { error }), "error");
      });

      unlistenImport = await onImportComplete((stats: ImportStats) => {
        void refreshData();
        showToast(
          t("toast.importSummary", { n: stats.new, skipped: stats.skipped }),
          "info"
        );
      });
    };

    void setup();

    return () => {
      unlistenRun?.();
      unlistenError?.();
      unlistenImport?.();
    };
  }, []);

  const toggleWatcher = async () => {
    if (watcherStatus.active) {
      await stopWatcher();
    } else {
      await startWatcher();
    }
    setWatcherStatus(await getWatcherStatus());
  };

  const reimportCsvs = async () => {
    const stats = await importExistingCsvs();
    return stats;
  };

  const updateStatsPath = async (path: string) => {
    await setStatsPath(path);
    const settings = await getSettings();
    await saveSettings({ ...settings, kovaak_stats_path: path });
    setSettingsPath(path);
    await startWatcher();
    setWatcherStatus(await getWatcherStatus());
  };

  return {
    watcherStatus,
    settingsPath,
    toggleWatcher,
    reimportCsvs,
    updateStatsPath,
    detectKovaakPath,
  };
}
