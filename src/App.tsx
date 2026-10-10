import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppProvider, useApp } from "@/hooks/useAppData";
import { useKovaakWatcher } from "@/hooks/useKovaakWatcher";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import { I18nProvider, useI18n } from "@/lib/i18n";

import { Header } from "@/components/Header";
import { ScenarioList } from "@/components/ScenarioList";
import { MetricsCards } from "@/components/MetricsCards";
import { ProgressChart } from "@/components/ProgressChart";
import { HistoryTable, copyEscalateToClipboard } from "@/components/HistoryTable";
import { SessionModal } from "@/components/SessionModal";
import { SensRandomizerView } from "@/components/SensRandomizerView";
import { PlaylistRunnerView } from "@/components/playlist/PlaylistRunnerView";
import { PlaylistManagerModal } from "@/components/playlist/PlaylistManagerModal";
import { DashboardPlaylistRunner } from "@/components/playlist/DashboardPlaylistRunner";
import { NewTaskModal } from "@/components/NewTaskModal";
import { SettingsModal } from "@/components/SettingsModal";
import { AimLabSyncModal } from "@/components/aimlab/AimLabSyncModal";
import { Toast } from "@/components/Toast";
import type { AppSettings, Playlist } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/tauri-bridge";
import { getStoredTheme, applyTheme, type AppTheme } from "@/lib/theme";

function Dashboard() {
  const {
    appData,
    activeTask,
    showToast,
    setActiveTaskId,
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

  const [activeTab, setActiveTab] = useState<"dashboard" | "randomizer" | "playlist">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aimlabOpen, setAimlabOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [playlistManagerOpen, setPlaylistManagerOpen] = useState(false);
  const [pendingPlaylistTaskIds, setPendingPlaylistTaskIds] = useState<string[]>([]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleAddToPlaylist = useCallback((taskIds: string[]) => {
    setPendingPlaylistTaskIds(taskIds);
    setPlaylistManagerOpen(true);
  }, []);

  const handleStartPlaylist = useCallback(
    (playlist: Playlist) => {
      playlistRunner.start(playlist);
    },
    [playlistRunner]
  );

  const { t } = useI18n();

  // Safety lock guard: if RawAccel is not available, guarantee user cannot remain on randomizer
  useEffect(() => {
    if (!rawaccelAvailable && activeTab === "randomizer") {
      setActiveTab("dashboard");
      showToast(t("toast.randomizerLocked"), "error");
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

  const handleCopyEscalate = useCallback(() => {
    if (copyEscalateToClipboard(activeTask)) {
      showToast(t("toast.copiedEscalate"), "success");
    } else {
      showToast(t("toast.noData"), "error");
    }
  }, [activeTask, showToast, t]);

  const handleUpdateAppSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const current = await getSettings();
      await saveSettings({ ...current, ...partial });
    },
    []
  );

  const handleApplySens = useCallback(
    async (sensCm: number) => {
      const rounded = Number(sensCm.toFixed(1));
      await saveRandomizerSettings({
        ...randomizerSettings,
        rangeMode: "cm360",
        baseSensCm: rounded,
      });
      showToast(t("playlist.appliedSuccess", { sens: rounded }), "success");
    },
    [randomizerSettings, saveRandomizerSettings, showToast, t]
  );

  return (
    <div className="relative min-h-screen h-screen bg-base text-text-main flex flex-row overflow-hidden selection:bg-score/25 selection:text-score">
      <div className="dot-bg" aria-hidden="true" />

      {/* Pane 1: Scenario Navigation Sidebar */}
      <ScenarioList
        tasks={appData.tasks}
        activeTaskId={appData.activeTaskId}
        onTaskChange={setActiveTaskId}
        onNewTask={() => setNewTaskOpen(true)}
        onDeleteTask={deleteCurrentTask}
        onAddToPlaylist={handleAddToPlaylist}
        playlists={appData.playlists ?? []}
        onStartPlaylist={handleStartPlaylist}
        onStopPlaylist={playlistRunner.stop}
        runningPlaylistId={playlistRunner.isRunning ? playlistRunner.activePlaylist?.id : null}
        runningStepIndex={playlistRunner.currentStepIndex}
        onJumpToStep={playlistRunner.jumpToStep}
        onOpenPlaylistManager={() => {
          setPendingPlaylistTaskIds([]);
          setPlaylistManagerOpen(true);
        }}
        onSyncGames={async () => {
          await syncGamePlaylists(true);
        }}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Pane 3: Main Workspace Stage */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto custom-scrollbar z-10">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rawaccelAvailable={rawaccelAvailable}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAimlab={() => setAimlabOpen(true)}
          watcherStatus={watcherStatus}
          onNewSession={() => setSessionModalOpen(true)}
          currentTheme={theme}
          onThemeChange={setTheme}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1550px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="space-y-5"
            >
              {activeTab === "dashboard" ? (
                <>
                  {/* Active Playlist Runner Banner in Dashboard */}
                  <DashboardPlaylistRunner runner={playlistRunner} />

                  {/* Top Full-Width KPI Metrics Cards */}
                  <section aria-label="KPI Metrics">
                    <MetricsCards activeTask={activeTask} />
                  </section>

                  {/* Full-Width Telemetry Data Chart ("Data Chart" in mockup) */}
                  <section aria-label="Telemetry Chart">
                    <ProgressChart activeTask={activeTask} />
                  </section>

                  {/* Full-Width Scenario History Table ("Scenario Table" in mockup) */}
                  <section aria-label="Session History">
                    <HistoryTable
                      activeTask={activeTask}
                      onDeleteSession={deleteSession}
                      onCopyEscalate={handleCopyEscalate}
                      onNewSession={() => setSessionModalOpen(true)}
                    />
                  </section>
                </>
              ) : activeTab === "randomizer" ? (
                <SensRandomizerView
                  activeTask={activeTask}
                  allTasks={appData.tasks}
                  playlists={appData.playlists ?? []}
                />
              ) : (
                <PlaylistRunnerView
                  runner={playlistRunner}
                  playlists={appData.playlists ?? []}
                  tasks={appData.tasks}
                  onOpenManager={() => {
                    setPendingPlaylistTaskIds([]);
                    setPlaylistManagerOpen(true);
                  }}
                  onSyncGames={async () => {
                    await syncGamePlaylists(true);
                  }}
                  onApplySens={handleApplySens}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="py-4 px-6 text-center text-xs text-text-faint border-t border-edge bg-[#07080c]/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1550px] mx-auto">
            <span className="opacity-80">{t("app.footer")}</span>
            <span className="font-medium text-[11px] px-2 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-edge">
              {t("app.footerFov")}
            </span>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <SessionModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        activeTask={activeTask}
        onSubmit={addManualSessions}
      />

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreate={createTask}
      />

      <SettingsModal
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
        onUpdateRawaccelPath={async (path) => {
          await saveRandomizerSettings({ ...randomizerSettings, rawaccelDir: path });
        }}
        onTestRawaccel={testRawaccelWriter}
        onExport={exportData}
        onImport={importData}
        onLoadDemo={loadDemoData}
        onClear={clearAllData}
        onUpdateAppSettings={handleUpdateAppSettings}
        currentTheme={theme}
        onThemeChange={setTheme}
      />

      <AimLabSyncModal
        open={aimlabOpen}
        onClose={() => setAimlabOpen(false)}
        onImportComplete={(_stats) => {
          // data refresh is handled by the event listener in useKovaakWatcher (onImportComplete Tauri event)
          // we just need to optionally close or do anything else, but toast and refresh are automated!
        }}
      />

      <PlaylistManagerModal
        open={playlistManagerOpen}
        onClose={() => {
          setPlaylistManagerOpen(false);
          setPendingPlaylistTaskIds([]);
        }}
        playlists={appData.playlists ?? []}
        tasks={appData.tasks}
        initialTaskIds={pendingPlaylistTaskIds}
        onCreatePlaylist={async (pl) => {
          await createPlaylist(pl.name, pl.items);
        }}
        onUpdatePlaylist={updatePlaylist}
        onDeletePlaylist={deletePlaylist}
        onStartPlaylist={handleStartPlaylist}
        onSyncGames={async () => {
          await syncGamePlaylists(true);
        }}
      />

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <Dashboard />
      </AppProvider>
    </I18nProvider>
  );
}

