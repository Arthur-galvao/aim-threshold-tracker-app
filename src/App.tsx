import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppProvider, useApp } from "@/hooks/useAppData";
import { useKovaakWatcher } from "@/hooks/useKovaakWatcher";
import { RandomizerProvider, useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useScenarioCentersSync } from "@/hooks/useScenarioCentersSync";
import { useWindowActivityGuard } from "@/hooks/useWindowActivityGuard";
import { TrackerWorkspaceProvider } from "@/context/TrackerWorkspaceContext";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ToastProvider, useToast } from "@/components/ui";
import { AppShell, type NavTab } from "@/components/shell";
import { DashboardView } from "@/components/views/dashboard";
import { RandomizerView } from "@/components/views/randomizer";
import { PlaylistView } from "@/components/views/playlist";
import {
  SessionSheet,
  SettingsDialog,
  NewScenarioDialog,
  PlaylistManagerDialog,
  AimLabSyncDialog,
} from "@/components/dialogs";
import type { AppSettings, Playlist } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/tauri-bridge";
import { applyTheme, getStoredTheme, type AppTheme } from "@/lib/theme";

function AppContent() {
  useWindowActivityGuard();
  const { t } = useI18n();
  const { showToast } = useToast();

  const {
    appData,
    activeTask,
    setActiveTaskId,
    loadDemoData,
    clearAllData,
    exportData,
    importData,
    createTask,
    addManualSessions,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncGamePlaylists,
    playlistRunner,
  } = useApp();

  const {
    watcherStatus,
    settingsPath,
    toggleWatcher,
    reimportCsvs,
    updateStatsPath,
    detectKovaakPath,
  } = useKovaakWatcher();

  const {
    settings: randomizerSettings,
    rawaccelAvailable,
    detectPath: detectRawaccelPath,
    saveSettings: saveRandomizerSettings,
    testWriter: testRawaccelWriter,
  } = useSensRandomizer();

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [playlistManagerOpen, setPlaylistManagerOpen] = useState(false);
  const [aimlabOpen, setAimlabOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sincroniza o mapa de centros de cenários com o backend Rust
  useScenarioCentersSync({
    tasks: appData.tasks,
    mouseDpi: randomizerSettings.mouseDpi,
    enabled: randomizerSettings.autoScenarioSens,
  });

  // Notifica o backend sobre o próximo cenário esperado na playlist
  useEffect(() => {
    const upcomingName = playlistRunner.isRunning
      ? playlistRunner.predictNextScenarioName()
      : null;
    void invoke("set_upcoming_scenario", {
      name: upcomingName,
      reroll: Boolean(playlistRunner.isRunning),
    }).catch(() => {});
  }, [
    playlistRunner.isRunning,
    playlistRunner.currentStepIndex,
    playlistRunner.sessionCountAtStart,
    playlistRunner.predictNextScenarioName,
  ]);

  // Safety lock guard: se RawAccel não estiver disponível, impede navegação para o randomizer
  useEffect(() => {
    if (!rawaccelAvailable && activeTab === "randomizer") {
      setActiveTab("dashboard");
      showToast(t("toast.randomizerLocked") || "RawAccel não disponível", "error");
    }
  }, [rawaccelAvailable, activeTab, showToast, t]);

  const handleDetectPath = useCallback(async () => {
    const detected = await detectKovaakPath();
    if (!detected) {
      showToast(t("toast.noKovaaK"), "error");
      return;
    }
    await updateStatsPath(detected);
    showToast(t("toast.pathDetected", { path: detected }), "success");
  }, [detectKovaakPath, updateStatsPath, showToast, t]);

  const handleUpdatePath = useCallback(
    async (path: string) => {
      await updateStatsPath(path);
      showToast(t("toast.pathUpdated"), "success");
    },
    [updateStatsPath, showToast, t]
  );

  const handleReimport = useCallback(async () => {
    await reimportCsvs();
  }, [reimportCsvs]);

  const handleUpdateAppSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const current = await getSettings();
      await saveSettings({ ...current, ...partial });
    },
    []
  );

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onOpenSettings={() => setSettingsOpen(true)}
      tasks={appData.tasks}
      activeTaskId={appData.activeTaskId}
      onSelectTask={setActiveTaskId}
      onNewScenario={() => setNewScenarioOpen(true)}
      onOpenSessionSheet={() => setSessionSheetOpen(true)}
      watcherActive={watcherStatus.active}
      onToggleWatcher={toggleWatcher}
      currentTheme={theme}
      onThemeChange={setTheme}
    >
      {activeTab === "dashboard" && <DashboardView />}
      {activeTab === "randomizer" && <RandomizerView />}
      {activeTab === "playlist" && (
        <PlaylistView onOpenManager={() => setPlaylistManagerOpen(true)} />
      )}

      {/* Dialogs / Sheets */}
      <SessionSheet
        open={sessionSheetOpen}
        onClose={() => setSessionSheetOpen(false)}
        onSubmit={addManualSessions}
        activeTask={activeTask}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        watcherStatus={watcherStatus}
        settingsPath={settingsPath}
        onDetectPath={handleDetectPath}
        onUpdatePath={handleUpdatePath}
        onToggleWatcher={toggleWatcher}
        onReimport={handleReimport}
        rawaccelPath={randomizerSettings.rawaccelDir}
        rawaccelAvailable={rawaccelAvailable}
        onDetectRawaccel={detectRawaccelPath}
        onUpdateRawaccelPath={async (path: string) => {
          await saveRandomizerSettings({ ...randomizerSettings, rawaccelDir: path });
        }}
        onTestRawaccel={testRawaccelWriter}
        onExport={exportData}
        onImport={importData}
        onLoadDemo={loadDemoData}
        onClear={clearAllData}
        onUpdateAppSettings={handleUpdateAppSettings}
        onOpenAimLab={() => setAimlabOpen(true)}
        currentTheme={theme}
        onThemeChange={setTheme}
      />

      <NewScenarioDialog
        open={newScenarioOpen}
        onOpenChange={setNewScenarioOpen}
        onCreate={createTask}
      />

      <PlaylistManagerDialog
        open={playlistManagerOpen}
        onClose={() => setPlaylistManagerOpen(false)}
        playlists={appData.playlists ?? []}
        tasks={appData.tasks}
        onCreatePlaylist={async (pl: Playlist) => {
          await createPlaylist(pl.name, pl.items);
        }}
        onUpdatePlaylist={updatePlaylist}
        onDeletePlaylist={deletePlaylist}
        onStartPlaylist={(pl) => {
          playlistRunner.start(pl);
          setActiveTab("playlist");
        }}
        onSyncGames={async () => {
          await syncGamePlaylists(true);
        }}
      />

      <AimLabSyncDialog
        open={aimlabOpen}
        onClose={() => setAimlabOpen(false)}
        onImportComplete={(stats) => {
          showToast(
            t("aimlab.success", {
              total: stats.total,
              new: stats.new,
              skipped: stats.skipped,
            }),
            "success"
          );
        }}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppProvider>
          <TrackerWorkspaceProvider>
            <RandomizerProvider>
              <AppContent />
            </RandomizerProvider>
          </TrackerWorkspaceProvider>
        </AppProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
