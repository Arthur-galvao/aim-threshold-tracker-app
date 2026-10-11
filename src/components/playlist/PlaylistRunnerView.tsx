import { useMemo, useState } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { getRecommendedSens } from "@/lib/viscose";
import {
  computePlaylistSensStats,
  formatSensitivity,
  getScenarioIdealSens,
  type PlaylistSensStats,
} from "@/lib/sens-analytics";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";

interface PlaylistRunnerViewProps {
  runner: PlaylistRunnerState;
  playlists: Playlist[];
  tasks: Task[];
  onOpenManager: () => void;
  onSyncGames?: () => Promise<void>;
  onApplySens?: (sensCm: number) => Promise<void>;
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
  onSyncGames,
  onApplySens,
}: PlaylistRunnerViewProps) {
  const { t } = useI18n();
  const [isSyncing, setIsSyncing] = useState(false);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const playlistStatsMap = useMemo(() => {
    const map = new Map<string, PlaylistSensStats>();
    for (const pl of playlists) {
      map.set(pl.id, computePlaylistSensStats(pl, tasks));
    }
    return map;
  }, [playlists, tasks]);

  const activePlaylistStats = useMemo(() => {
    if (!runner.activePlaylist) return null;
    return (
      playlistStatsMap.get(runner.activePlaylist.id) ??
      computePlaylistSensStats(runner.activePlaylist, tasks)
    );
  }, [runner.activePlaylist, playlistStatsMap, tasks]);

  const handleSync = async () => {
    if (!onSyncGames || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncGames();
    } finally {
      setIsSyncing(false);
    }
  };

  // Currently running a playlist
  const { activePlaylist, currentStepIndex, currentItem, currentTask } = runner;
  const isLastStep = activePlaylist
    ? currentStepIndex === activePlaylist.items.length - 1
    : false;
  const idealSens = currentTask ? getScenarioIdealSens(currentTask, tasks) : null;
  const recSens = idealSens ? idealSens.value : (currentTask ? getRecommendedSens(currentTask.category, currentTask.subcategory) : null);
  const isPlaylistPredicted = activePlaylistStats?.displaySens.source === "predicted";

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

  // If no playlist is running and not finished, show available playlists to start
  if (!activePlaylist) {
    return (
      <div className="space-y-4">
        <div className="panel p-5 rounded-[10px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-edge">
          <div>
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-main">
              {t("playlist.title")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onSyncGames && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="bg-surface py-2 px-3.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest text-text-secondary hover:text-text-main border border-edge flex items-center gap-1.5 transition-all disabled:opacity-50"
                title={t("playlist.syncGames")}
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
                <span>{isSyncing ? "SYNCING..." : "SYNC KOVAAK"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenManager}
              className="bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-2 px-4 rounded-lg text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span className="text-[10px] leading-none">+</span>
              <span>CREATE NEW</span>
            </button>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="panel p-12 rounded-[10px] border border-edge text-center">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">
              {t("playlist.emptyList")}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((playlist) => {
              const stats = playlistStatsMap.get(playlist.id) ?? computePlaylistSensStats(playlist, tasks);
              const isPredicted = stats.displaySens.source === "predicted";

              return (
                <div
                  key={playlist.id}
                  className="panel p-4 rounded-[10px] border border-edge hover:border-edge-strong transition-all flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-semibold text-text-main truncate">
                        {playlist.name}
                      </h3>
                      <span className="text-[9px] px-1.5 rounded-sm bg-surface-subtle border border-edge text-text-faint font-mono font-bold">
                        {playlist.items.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {playlist.items.slice(0, 4).map((item, idx) => {
                        const task = taskMap.get(item.taskId);
                        return (
                          <span
                            key={item.id}
                            className="px-1.5 py-0.5 rounded-sm bg-surface-subtle border border-edge text-[10px] font-mono text-text-secondary truncate max-w-[120px]"
                          >
                            {idx + 1}. {task ? task.name : `#${item.taskId}`}
                          </span>
                        );
                      })}
                      {playlist.items.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-surface-subtle border border-edge text-[10px] font-mono text-text-faint">
                          +{playlist.items.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Recommended Sens Badge & Quick Apply */}
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-secondary">
                          {t("playlist.recommendedSens")}:
                        </span>
                        <span className="font-mono font-bold text-[11px] text-text-main">
                          {formatSensitivity(stats.displaySens.value)}
                        </span>
                        {isPredicted ? (
                          <span className="text-[9px] px-1 rounded-sm font-semibold bg-emerald/10 text-emerald border border-emerald/20">
                            PREDICTED
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 rounded-sm font-semibold bg-surface-subtle text-text-faint border border-edge">
                            VISCOSE
                          </span>
                        )}
                      </div>
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(stats.displaySens.value)}
                          className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest rounded-sm bg-surface border border-edge hover:bg-surface-hover text-text-main transition-colors shrink-0"
                          title={t("playlist.applySens")}
                        >
                          APPLY
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-edge">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">
                      {new Date(playlist.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => runner.start(playlist)}
                      className="bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-1.5 px-3 rounded-lg text-[9px] flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <span>START</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // If finished
  if (runner.isFinished) {
    return (
      <div className="panel p-8 sm:p-12 rounded-[10px] border border-edge text-center max-w-lg mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/30 text-emerald mx-auto flex items-center justify-center">
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
          <h2 className="text-[14px] font-mono font-bold uppercase tracking-widest text-text-main">
            {t("runner.completed")}
          </h2>
          <p className="text-[11px] font-mono text-text-faint mt-1.5 max-w-sm mx-auto uppercase tracking-widest">
            {t("runner.completedDesc")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={runner.restart}
            className="w-full sm:w-auto bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-2 px-5 rounded-lg text-[10px] shadow-sm transition-all"
          >
            RESTART
          </button>
          <button
            type="button"
            onClick={runner.stop}
            className="w-full sm:w-auto bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-main font-mono font-bold uppercase tracking-widest py-2 px-5 rounded-lg text-[10px] border border-edge transition-all"
          >
            CHOOSE OTHER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with Playlist title & exit button */}
      <div className="panel p-4 sm:p-5 rounded-[10px] border border-edge flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-score/10 border border-score/30 text-score flex items-center justify-center shrink-0">
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
            <h2 className="text-[12px] font-mono font-bold uppercase tracking-widest text-text-main truncate">
              {activePlaylist.name}
            </h2>
            <span className="text-[10px] font-mono text-text-faint uppercase tracking-widest">
              {t("runner.progress", {
                current: currentStepIndex + 1,
                total: activePlaylist.items.length,
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenManager}
            className="px-3 py-1.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-widest bg-surface text-text-secondary hover:text-text-main border border-edge transition-colors hidden sm:inline-block"
          >
            EDIT
          </button>
          <button
            type="button"
            onClick={runner.stop}
            className="px-3 py-1.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-widest bg-surface text-text-faint hover:text-red hover:bg-red/10 border border-edge transition-colors"
          >
            EXIT
          </button>
        </div>
      </div>

      {/* Stepper Horizontal */}
      <div className="panel p-4 rounded-[10px] border border-edge">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
          {activePlaylist.items.map((item, index) => {
            const task = taskMap.get(item.taskId);
            const isCompleted = runner.completedStepIndices.has(index);
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[10px] font-mono uppercase tracking-widest shrink-0 transition-all ${
                  isCurrent
                    ? "bg-score/10 text-score border-score/40 font-bold shadow-sm"
                    : isCompleted
                    ? "bg-surface-subtle text-text-secondary border-edge opacity-80"
                    : "bg-surface text-text-faint border-edge opacity-50"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-sm text-[9px] flex items-center justify-center font-mono ${
                    isCurrent
                      ? "bg-score text-surface font-bold"
                      : isCompleted
                      ? "bg-emerald/20 text-emerald font-bold"
                      : "bg-surface-subtle border border-edge text-text-faint"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
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
      <div className="panel p-6 sm:p-8 rounded-[10px] border border-edge space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge pb-5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-score">
              {t("runner.currentScenario")}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main mt-1 font-mono uppercase tracking-wider">
              {currentTask ? currentTask.name : `Task #${currentItem?.taskId}`}
            </h1>
            {currentTask && (
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-faint mt-2 flex-wrap">
                <span className="px-1.5 rounded-sm bg-surface-subtle border border-edge text-text-secondary font-bold">
                  {currentTask.category}
                </span>
                <span>/</span>
                <span className="px-1.5 rounded-sm bg-surface-subtle border border-edge text-text-secondary font-bold">
                  {currentTask.subcategory}
                </span>

                {recSens && (
                  <>
                    <span>/</span>
                    <div className="inline-flex items-center gap-1.5 pl-1.5 border-l border-edge">
                      <span className="text-text-secondary">{t("runner.scenarioSens")}:</span>
                      <span className="px-1.5 rounded-sm bg-score/10 text-score border border-score/20 font-bold flex items-center gap-1">
                        <span>{recSens} cm</span>
                        {idealSens && (
                          <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-normal">
                            {idealSens.source === "empirical" ? "EMP" : "VIS"}
                          </span>
                        )}
                      </span>
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(recSens)}
                          className="px-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-edge text-text-main transition-colors"
                          title={t("runner.applySens")}
                        >
                          APPLY
                        </button>
                      )}
                    </div>
                  </>
                )}

                {activePlaylistStats && (
                  <>
                    <span>/</span>
                    <div className="inline-flex items-center gap-1.5 pl-1.5 border-l border-edge">
                      <span className="text-text-secondary">{t("runner.playlistSens")}:</span>
                      <span className="px-1.5 rounded-sm bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                        {formatSensitivity(activePlaylistStats.displaySens.value)}
                      </span>
                      {isPlaylistPredicted ? (
                        <span className="text-[9px] px-1 rounded-sm font-semibold bg-emerald/10 text-emerald border border-emerald/20">
                          PRED
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 rounded-sm font-semibold bg-surface-subtle text-text-faint border border-edge">
                          VISC
                        </span>
                      )}
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(activePlaylistStats.displaySens.value)}
                          className="px-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-edge text-text-main transition-colors"
                          title={t("runner.applySens")}
                        >
                          APPLY
                        </button>
                      )}
                    </div>
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
                className="bg-surface py-2 px-4 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest text-text-secondary hover:text-text-main border border-edge transition-all"
              >
                PREV
              </button>
            )}

            <button
              type="button"
              onClick={runner.next}
              className="bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-2 px-5 rounded-md text-[10px] flex items-center gap-2 shadow-sm transition-all"
            >
              <span>{isLastStep ? "FINISH" : "NEXT"}</span>
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
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono font-bold uppercase tracking-widest text-text-main">
              {progressLabel}
            </span>
            <span className="font-mono text-[11px] font-bold text-text-secondary">
              {Math.round(progressPercentage)}%
            </span>
          </div>

          <div className="w-full h-1.5 rounded-none bg-surface-subtle border border-edge overflow-hidden">
            <div
              className="h-full bg-score transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <p className="text-[9px] font-mono uppercase tracking-widest text-text-faint text-center sm:text-left">
            {t("runner.autoAdvanceNote")}
          </p>
        </div>
      </div>
    </div>
  );
}

