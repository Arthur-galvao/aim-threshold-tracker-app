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
    <div className="min-h-screen bg-base text-text-main flex flex-col transition-colors duration-200">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={exportData}
        onImport={importData}
        onLoadDemo={loadDemoData}
        onClear={clearAllData}
        watcherStatus={watcherStatus}
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <TaskSelector
            tasks={appData.tasks}
            activeTaskId={appData.activeTaskId}
            onTaskChange={setActiveTaskId}
            onNewTask={() => setNewTaskOpen(true)}
            onDeleteTask={deleteCurrentTask}
          />

          <SessionForm activeTask={activeTask} onSubmit={addManualSessions} />
        </div>

        <div className="lg:col-span-8 space-y-6">
          <MetricsCards activeTask={activeTask} />
          <ProgressChart activeTask={activeTask} />
          <HistoryTable
            activeTask={activeTask}
            onDeleteSession={deleteSession}
            onCopyEscalate={handleCopyEscalate}
          />
        </div>
      </main>

      <footer className="border-t border-edge py-6 px-4 text-center text-xs text-text-faint transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t("app.footer")}</span>
          <span className="font-mono text-[11px]">{t("app.footerFov")}</span>
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
