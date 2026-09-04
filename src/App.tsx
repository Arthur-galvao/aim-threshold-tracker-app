import { useCallback, useState } from "react";
import { AppProvider, useApp } from "@/hooks/useAppData";
import { useKovaakWatcher } from "@/hooks/useKovaakWatcher";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { TaskSelector } from "@/components/TaskSelector";
import { SessionForm } from "@/components/SessionForm";
import { MetricsCards } from "@/components/MetricsCards";
import { ProgressChart } from "@/components/ProgressChart";
import { HistoryTable, copyEscalateToClipboard } from "@/components/HistoryTable";
import { NewTaskModal } from "@/components/NewTaskModal";
import { SettingsModal } from "@/components/SettingsModal";
import { Toast } from "@/components/Toast";

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
  } = useApp();

  const {
    watcherStatus,
    settingsPath,
    toggleWatcher,
    reimportCsvs,
    updateStatsPath,
    detectKovaakPath,
  } = useKovaakWatcher();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const { t } = useI18n();

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

  return (
    <div className="relative min-h-screen bg-base text-text-main flex flex-col selection:bg-blue-500/25 selection:text-blue-200">
      <div className="dot-bg" aria-hidden="true" />

      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={exportData}
        onImport={importData}
        onLoadDemo={loadDemoData}
        onClear={clearAllData}
        watcherStatus={watcherStatus}
      />

      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col gap-6">
        {/* Top Full-Width KPI Metrics Cards */}
        <section aria-label="Métricas Principais">
          <MetricsCards activeTask={activeTask} />
        </section>

        {/* 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Task Selector & Manual Entry */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-6">
            <TaskSelector
              tasks={appData.tasks}
              activeTaskId={appData.activeTaskId}
              onTaskChange={setActiveTaskId}
              onNewTask={() => setNewTaskOpen(true)}
              onDeleteTask={deleteCurrentTask}
            />

            <SessionForm activeTask={activeTask} onSubmit={addManualSessions} />
          </div>

          {/* Right Column: Chart & History Table */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">
            <ProgressChart activeTask={activeTask} />
            <HistoryTable
              activeTask={activeTask}
              onDeleteSession={deleteSession}
              onCopyEscalate={handleCopyEscalate}
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 px-4 text-center text-xs text-text-faint">
        <div className="max-w-7xl mx-auto border-t border-white/[0.04] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="opacity-80">{t("app.footer")}</span>
          <span className="font-medium text-[11px] px-2.5 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-edge">
            {t("app.footerFov")}
          </span>
        </div>
      </footer>

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
