import { useState } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { getRecommendedSens } from "@/lib/viscose";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";

interface PlaylistRunnerViewProps {
  runner: PlaylistRunnerState;
  playlists: Playlist[];
  tasks: Task[];
  onOpenManager: () => void;
  onSyncKovaak?: () => Promise<void>;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlaylistRunnerView({
  runner,
  playlists,
  tasks,
  onOpenManager,
  onSyncKovaak,
}: PlaylistRunnerViewProps) {
  const { t } = useI18n();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!onSyncKovaak || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncKovaak();
    } finally {
      setIsSyncing(false);
    }
  };

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // If no playlist is running and not finished, show available playlists to start
  if (!runner.activePlaylist) {
    return (
      <div className="space-y-6">
        <div className="panel p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-text-main">
              {t("playlist.title")}
            </h2>
            <p className="text-xs text-text-faint mt-1">
              {t("playlist.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onSyncKovaak && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="minimal-btn-secondary py-2 px-3.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border-edge flex items-center gap-1.5 transition-all disabled:opacity-50"
                title={t("playlist.syncKovaak")}
              >
                <svg
                  className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{isSyncing ? t("playlist.syncing") : t("playlist.syncKovaak")}</span>
              </button>
            )}
            <button
              onClick={onOpenManager}
              className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span className="text-xs font-bold leading-none">+</span>
              <span>{t("playlist.createNew")}</span>
            </button>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="panel p-12 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-surface-subtle border border-edge mx-auto flex items-center justify-center text-text-faint mb-4">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-text-main">
              {t("playlist.emptyList")}
            </h3>
            {onSyncKovaak && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="minimal-btn-secondary py-2 px-4 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border-edge inline-flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>{isSyncing ? t("playlist.syncing") : t("playlist.syncKovaak")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="panel p-5 rounded-2xl hover:border-white/20 transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-text-main truncate">
                      {playlist.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-subtle border border-edge text-text-faint font-medium">
                      {t("playlist.itemsCount", { n: playlist.items.length })}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {playlist.items.slice(0, 4).map((item, idx) => {
                      const task = taskMap.get(item.taskId);
                      return (
                        <span
                          key={item.id}
                          className="px-2 py-0.5 rounded bg-surface-subtle border border-edge text-[10px] text-text-secondary truncate max-w-[120px]"
                        >
                          {idx + 1}. {task ? task.name : `#${item.taskId}`}
                        </span>
                      );
                    })}
                    {playlist.items.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-edge text-[10px] text-text-faint">
                        +{playlist.items.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-edge">
                  <span className="text-[11px] text-text-faint">
                    {new Date(playlist.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => runner.start(playlist)}
                    className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{t("playlist.start")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If finished
  if (runner.isFinished) {
    return (
      <div className="panel p-8 sm:p-12 rounded-2xl text-center max-w-lg mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-text-main">
            {t("runner.completed")}
          </h2>
          <p className="text-xs text-text-faint mt-1.5 max-w-sm mx-auto">
            {t("runner.completedDesc")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={runner.restart}
            className="w-full sm:w-auto minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-5 rounded-xl text-xs shadow-sm transition-all"
          >
            {t("runner.restart")}
          </button>
          <button
            onClick={runner.stop}
            className="w-full sm:w-auto minimal-btn-secondary py-2 px-5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border-edge"
          >
            {t("runner.chooseOther")}
          </button>
        </div>
      </div>
    );
  }

  // Currently running a playlist
  const { activePlaylist, currentStepIndex, currentItem, currentTask } = runner;
  const isLastStep = currentStepIndex === activePlaylist.items.length - 1;
  const recSens = currentTask
    ? getRecommendedSens(currentTask.category, currentTask.subcategory)
    : null;

  // Calculation for progress
  let progressPercentage = 0;
  let progressLabel = "";

  if (currentItem) {
    if (currentItem.targetMode === "reps") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - runner.sessionCountAtStart);
      const targetReps = currentItem.targetValue;
      progressPercentage = Math.min(100, (completedReps / targetReps) * 100);
      progressLabel = t("runner.goalReps", {
        current: completedReps,
        target: targetReps,
      });
    } else {
      const elapsed = runner.elapsedSeconds;
      const target = currentItem.targetValue;
      progressPercentage = Math.min(100, (elapsed / target) * 100);
      const remaining = Math.max(0, target - elapsed);
      progressLabel = t("runner.goalTime", {
        remaining: formatDuration(remaining),
        current: elapsed,
        target,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Playlist title & exit button */}
      <div className="panel p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-main truncate">
              {activePlaylist.name}
            </h2>
            <span className="text-[11px] text-text-faint">
              {t("runner.progress", {
                current: currentStepIndex + 1,
                total: activePlaylist.items.length,
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenManager}
            className="minimal-btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-main border-edge hidden sm:inline-block"
          >
            {t("playlist.edit")}
          </button>
          <button
            onClick={runner.stop}
            className="minimal-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-text-faint hover:text-red hover:bg-red-500/10 border-edge transition-colors"
          >
            {t("runner.exit")}
          </button>
        </div>
      </div>

      {/* Stepper Horizontal */}
      <div className="panel p-4 rounded-2xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
          {activePlaylist.items.map((item, index) => {
            const task = taskMap.get(item.taskId);
            const isCompleted = runner.completedStepIndices.has(index);
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs shrink-0 transition-all ${
                  isCurrent
                    ? "bg-blue-500 text-white border-blue-500 shadow-sm font-semibold"
                    : isCompleted
                    ? "bg-surface-subtle text-text-secondary border-edge opacity-80"
                    : "bg-surface text-text-faint border-edge opacity-50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                    isCurrent
                      ? "bg-white text-blue-600 font-bold"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400 font-bold"
                      : "bg-surface-subtle text-text-faint"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </span>
                <span className="truncate max-w-[110px]">
                  {task ? task.name : `#${item.taskId}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Scenario Card */}
      <div className="panel p-6 sm:p-8 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge pb-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              {t("runner.currentScenario")}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main mt-1">
              {currentTask ? currentTask.name : `Task #${currentItem?.taskId}`}
            </h1>
            {currentTask && (
              <div className="flex items-center gap-2 text-xs text-text-faint mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-surface-subtle border border-edge text-text-secondary font-medium">
                  {currentTask.category}
                </span>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-subtle border border-edge text-text-secondary font-medium">
                  {currentTask.subcategory}
                </span>
                {recSens && (
                  <>
                    <span>·</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold font-mono">
                      {recSens} cm/360
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {runner.currentStepIndex > 0 && (
              <button
                type="button"
                onClick={runner.previous}
                className="minimal-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border-edge"
              >
                {t("runner.previous")}
              </button>
            )}

            <button
              type="button"
              onClick={runner.next}
              className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <span>{isLastStep ? t("runner.finish") : t("runner.next")}</span>
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar & Target Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-main text-sm">
              {progressLabel}
            </span>
            <span className="font-mono text-xs text-text-secondary">
              {Math.round(progressPercentage)}%
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-surface-subtle border border-edge overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <p className="text-[11px] text-text-faint text-center sm:text-left">
            {t("runner.autoAdvanceNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
