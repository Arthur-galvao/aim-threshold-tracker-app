import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppProvider, useApp } from "@/hooks/useAppData";
import { SettingsProvider, useSettings } from "@/hooks/useSettings";
import { WatcherProvider, useWatcher } from "@/hooks/useKovaakWatcher";
import { RandomizerProvider, useSensRandomizer } from "@/hooks/useSensRandomizer";
import { LiveSessionProvider, useLiveSession } from "@/hooks/useLiveSession";
import { useScenarioMetaSync } from "@/hooks/useScenarioMetaSync";
import { useWindowActivityGuard } from "@/hooks/useWindowActivityGuard";
import { useTrayLabels } from "@/hooks/useTrayLabels";
import { TrackerWorkspaceProvider } from "@/context/TrackerWorkspaceContext";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ToastProvider, useToast, MigrationProgress, FocusPromptHost } from "@/components/ui";
import { AppShell, type NavTab } from "@/components/shell";
import { DashboardView } from "@/components/views/dashboard";
import { RecoveryNotice } from "@/components/dialogs/RecoveryNotice";
import type { AppSettings, Playlist } from "@/lib/types";
import { applyTheme, getStoredTheme, type AppTheme } from "@/lib/theme";

// T8.9: views fora do caminho inicial (dashboard segue eager).
const RandomizerView = lazy(() => import("@/components/views/randomizer"));
const PlaylistView = lazy(() => import("@/components/views/playlist"));
const LabView = lazy(() => import("@/components/views/lab"));

// T8.9: diálogos pesados só são baixados/montados na primeira abertura.
const SessionSheet = lazy(() =>
  import("@/components/dialogs/SessionSheet").then((m) => ({ default: m.SessionSheet }))
);
const SettingsDialog = lazy(() =>
  import("@/components/dialogs/SettingsDialog").then((m) => ({ default: m.SettingsDialog }))
);
const NewScenarioDialog = lazy(() =>
  import("@/components/dialogs/NewScenarioDialog").then((m) => ({ default: m.NewScenarioDialog }))
);
const PlaylistManagerDialog = lazy(() =>
  import("@/components/dialogs/PlaylistManagerDialog").then((m) => ({
    default: m.PlaylistManagerDialog,
  }))
);
const AimLabSyncDialog = lazy(() =>
  import("@/components/dialogs/AimLabSyncDialog").then((m) => ({ default: m.AimLabSyncDialog }))
);
const SessionSummaryDialog = lazy(() =>
  import("@/components/dialogs/SessionSummaryDialog").then((m) => ({
    default: m.SessionSummaryDialog,
  }))
);

/** Verdadeiro desde a primeira vez que `open` foi true (mantém montado para a animação de saída). */
function useEverOpened(open: boolean): boolean {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever;
}

function ViewSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex-1 min-h-[320px] rounded-tile liquid-surface opacity-60 animate-pulse"
    />
  );
}

function AppContent() {
  useWindowActivityGuard();
  useTrayLabels();
  const { t } = useI18n();
  const { showToast } = useToast();
  const live = useLiveSession();

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

  const { updateSettings } = useSettings();

  const {
    watcherStatus,
    settingsPath,
    toggleWatcher,
    reimportCsvs,
    updateStatsPath,
    detectKovaakPath,
  } = useWatcher();

  const {
    settings: randomizerSettings,
    rawaccelAvailable,
    detectPath: detectRawaccelPath,
    saveSettings: saveRandomizerSettings,
    testWriter: testRawaccelWriter,
  } = useSensRandomizer();

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("dialog");
      return p === "settings" || window.location.hash === "#settings";
    }
    return false;
  });
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [playlistManagerOpen, setPlaylistManagerOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("dialog");
      return p === "playlists" || p === "playlist-editor" || window.location.hash === "#playlists";
    }
    return false;
  });
  const [aimlabOpen, setAimlabOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sincroniza a meta (centro, categoria, subcategoria) dos cenários com o backend Rust
  useScenarioMetaSync({
    tasks: appData.tasks,
    baseSensCm: randomizerSettings.baseSensCm,
    centerSource: randomizerSettings.centerSource,
    centerOverrides: randomizerSettings.centerOverrides,
  });

  // Notifica o backend sobre o próximo cenário esperado na playlist (só envia quando muda)
  const upcomingName = useMemo(
    () => (playlistRunner.isRunning ? playlistRunner.predictNextScenarioName() : null),
    [
      playlistRunner.isRunning,
      playlistRunner.currentStepIndex,
      playlistRunner.sessionCountAtStart,
      playlistRunner.activePlaylist?.id,
      playlistRunner.predictNextScenarioName,
    ]
  );
  const reroll = Boolean(playlistRunner.isRunning);
  const lastUpcomingKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify({ name: upcomingName, reroll });
    if (key === lastUpcomingKeyRef.current) return;
    lastUpcomingKeyRef.current = key;
    void invoke("set_upcoming_scenario", { name: upcomingName, reroll }).catch(() => {});
  }, [upcomingName, reroll]);

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
      await updateSettings(partial);
    },
    [updateSettings]
  );

  const summaryEver = useEverOpened(live.dialogOpen);
  const sheetEver = useEverOpened(sessionSheetOpen);
  const settingsEver = useEverOpened(settingsOpen);
  const newScenarioEver = useEverOpened(newScenarioOpen);
  const managerEver = useEverOpened(playlistManagerOpen);
  const aimlabEver = useEverOpened(aimlabOpen);

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
      <Suspense fallback={<ViewSkeleton />}>
        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "randomizer" && <RandomizerView />}
        {activeTab === "lab" && <LabView />}
        {activeTab === "playlist" && (
          <PlaylistView onOpenManager={() => setPlaylistManagerOpen(true)} />
        )}
      </Suspense>

      {/* Dialogs / Sheets */}
      <Suspense fallback={null}>
      {summaryEver && (
        <SessionSummaryDialog
          open={live.dialogOpen}
          onClose={live.closeSummary}
          summary={live.summary}
          live={live.live}
          onEnd={live.endSession}
        />
      )}
      {sheetEver && (
        <SessionSheet
          open={sessionSheetOpen}
          onClose={() => setSessionSheetOpen(false)}
          onSubmit={addManualSessions}
          activeTask={activeTask}
        />
      )}

      {settingsEver && (
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
      )}

      {newScenarioEver && (
        <NewScenarioDialog
          open={newScenarioOpen}
          onOpenChange={setNewScenarioOpen}
          onCreate={createTask}
        />
      )}

      {managerEver && (
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
      )}

      {aimlabEver && (
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
      )}

      </Suspense>

      <RecoveryNotice />
      <MigrationProgress />
      <FocusPromptHost />
    </AppShell>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <SettingsProvider>
          <AppProvider>
            <WatcherProvider>
              <TrackerWorkspaceProvider>
                <RandomizerProvider>
                  <LiveSessionProvider>
                    <AppContent />
                  </LiveSessionProvider>
                </RandomizerProvider>
              </TrackerWorkspaceProvider>
            </WatcherProvider>
          </AppProvider>
        </SettingsProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
