import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppProvider, useApp } from "@/hooks/useAppData";
import { useKovaakWatcher } from "@/hooks/useKovaakWatcher";
import { RandomizerProvider, useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useScenarioCentersSync } from "@/hooks/useScenarioCentersSync";
import { invoke } from "@tauri-apps/api/core";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ScenarioList } from "@/components/ScenarioList";
import { LiquidAeroBackdrop } from "@/components/layout/LiquidAeroBackdrop";
import { copyEscalateToClipboard } from "@/components/HistoryTable";
import { SessionModal } from "@/components/SessionModal";
import { SensRandomizerView } from "@/components/SensRandomizerView";
import { PlaylistRunnerView } from "@/components/playlist/PlaylistRunnerView";
import { PlaylistManagerModal } from "@/components/playlist/PlaylistManagerModal";
import { DashboardPlaylistRunner } from "@/components/playlist/DashboardPlaylistRunner";
import { ScenarioDialog } from "@/components/dialogs/ScenarioDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { AimLabSyncModal } from "@/components/aimlab/AimLabSyncModal";
import { useWindowActivityGuard } from "@/hooks/useWindowActivityGuard";
import { TrackerWorkspaceProvider } from "@/context/TrackerWorkspaceContext";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { CommandBar } from "@/components/layout/CommandBar";
import { TelemetryBento } from "@/components/bento/TelemetryBento";
import { RatchetAnalyticsStage } from "@/components/analytics/RatchetAnalyticsStage";
import { SessionQuickComposer } from "@/components/composer/SessionQuickComposer";
import { SessionLedger } from "@/components/ledger/SessionLedger";
import { TelemetryToast } from "@/components/telemetry/TelemetryToast";
import type { AppSettings, Playlist } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/tauri-bridge";
import { getStoredTheme, applyTheme, type AppTheme } from "@/lib/theme";

function Dashboard() {
  useWindowActivityGuard();

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1100;
    }
    return false;
  });
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

  // Dynamically auto-collapse sidebar on smaller resolutions / snapped windows
  useEffect(() => {
    let timeoutId: number;
    const handleResize = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (window.innerWidth < 1024) {
          setSidebarCollapsed(true);
        }
      }, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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

  // Sincroniza o mapa de centros de cenários com o backend Rust com debounce e estabilização
  useScenarioCentersSync({
    tasks: appData.tasks,
    mouseDpi: randomizerSettings.mouseDpi,
    enabled: randomizerSettings.autoScenarioSens,
  });

  // Notifica o backend sobre o próximo cenário esperado na playlist (com re-sorteio corretivo se >3%)
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
      const overrides = { ...(randomizerSettings.centerOverrides || {}) };
      if (activeTask?.name) {
        overrides[activeTask.name.trim().toLowerCase()] = rounded;
      }
      await saveRandomizerSettings({
        ...randomizerSettings,
        scenarioIdealCm: rounded,
        centerOverrides: overrides,
      });
      showToast(t("playlist.appliedSuccess", { sens: rounded }), "success");
    },
    [activeTask?.name, randomizerSettings, saveRandomizerSettings, showToast, t]
  );

  return (
    <div className="relative min-h-screen h-screen bg-transparent text-text-main flex flex-row overflow-hidden selection:bg-score/25 selection:text-score">
      <LiquidAeroBackdrop />

      {/* Pane 1: Scenario Navigation Sidebar */}
      <ScenarioList
        tasks={appData.tasks}
        activeTaskId={appData.activeTaskId}
        mouseDpi={randomizerSettings.mouseDpi}
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

      {/* Pane 3: Main Workspace Stage (Single Master Top CommandBar) */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto custom-scrollbar z-10">
        <main className="flex-1 w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {activeTab === "dashboard" ? (
                <WorkspaceShell>
                  {/* Master Single Top HUD: Liquid Glass CommandBar */}
                  <CommandBar
                    onNewScenario={() => setNewTaskOpen(true)}
                    onOpenSettings={() => setSettingsOpen(true)}
                  />

                  {/* Active Playlist Runner Banner in Dashboard (only if active) */}
                  {playlistRunner.isRunning && (
                    <DashboardPlaylistRunner
                      runner={playlistRunner}
                      tasks={appData.tasks}
                      mouseDpi={randomizerSettings.mouseDpi}
                    />
                  )}

                  {/* Top Full-Width KPI Metrics Cards / Telemetry Bento (Directly below navbar with 24px gap) */}
                  <section aria-label="KPI Metrics">
                    <TelemetryBento mouseDpi={randomizerSettings.mouseDpi} />
                  </section>

                  {/* Tactical 2-Column Analytics Stage & Quick Composer (24px gap) */}
                  <div className="grid grid-cols-12 gap-6 items-stretch">
                    <section aria-label="Telemetry Chart" className="col-span-12 xl:col-span-8">
                      <RatchetAnalyticsStage />
                    </section>
                    <section aria-label="Session Quick Composer" className="col-span-12 xl:col-span-4">
                      <SessionQuickComposer defaultSens={activeTask?.sessions?.slice(-1)[0]?.sens} />
                    </section>
                  </div>

                  {/* Full-Width Scenario History Ledger (24px gap) */}
                  <section aria-label="Session History">
                    <SessionLedger
                      mouseDpi={randomizerSettings.mouseDpi}
                      onCopyEscalate={handleCopyEscalate}
                      onDeleteSession={deleteSession}
                    />
                  </section>
                </WorkspaceShell>
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
                  mouseDpi={randomizerSettings.mouseDpi}
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

        <footer className="py-4 px-6 text-center text-xs text-text-faint border-t border-edge bg-surface/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1550px] mx-auto">
            <span className="opacity-80">{t("app.footer")}</span>
            <span className="font-medium text-[11px] px-2.5 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-edge">
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

      <ScenarioDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
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

      <TelemetryToast />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <TrackerWorkspaceProvider>
          <RandomizerProvider>
            <Dashboard />
          </RandomizerProvider>
        </TrackerWorkspaceProvider>
      </AppProvider>
    </I18nProvider>
  );
}

