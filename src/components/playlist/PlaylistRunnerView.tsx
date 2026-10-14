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
  mouseDpi?: number;
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
  mouseDpi,
  onOpenManager,
  onSyncGames,
  onApplySens,
}: PlaylistRunnerViewProps) {
  const { t } = useI18n();
  const dpi = mouseDpi || 800;
  const [isSyncing, setIsSyncing] = useState(false);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const playlistStatsMap = useMemo(() => {
    const map = new Map<string, PlaylistSensStats>();
    for (const pl of playlists) {
      map.set(pl.id, computePlaylistSensStats(pl, tasks, "equilibrado", dpi));
    }
    return map;
  }, [playlists, tasks, dpi]);

  const activePlaylistStats = useMemo(() => {
    if (!runner.activePlaylist) return null;
    return (
      playlistStatsMap.get(runner.activePlaylist.id) ??
      computePlaylistSensStats(runner.activePlaylist, tasks, "equilibrado", dpi)
    );
  }, [runner.activePlaylist, playlistStatsMap, tasks, dpi]);

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
  const idealSens = currentTask ? getScenarioIdealSens(currentTask, tasks, dpi) : null;
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
        <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 enter" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <h2 className="text-sm font-semibold text-text-main font-sans">
              {t("playlist.title")}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {t("playlist.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onSyncGames && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="press bg-surface-subtle py-2 px-3.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border border-edge flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
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
                <span>{isSyncing ? t("playlist.syncing") : t("playlist.syncGames")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenManager}
              className="press bg-score hover:brightness-105 text-primary-foreground font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>+</span>
              <span>{t("playlist.createNew")}</span>
            </button>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl border border-dashed border-edge text-center enter" style={{ "--i": 1 } as React.CSSProperties}>
            <p className="text-xs text-text-faint">
              {t("playlist.emptyList")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((playlist, index) => {
              const stats = playlistStatsMap.get(playlist.id) ?? computePlaylistSensStats(playlist, tasks);
              const isPredicted = stats.displaySens.source === "predicted";

              return (
                <div
                  key={playlist.id}
                  style={{ "--i": index } as React.CSSProperties}
                  className="glass-card-interactive p-5 rounded-2xl border border-edge flex flex-col justify-between gap-4 enter"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-text-main truncate">
                        {playlist.name}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-subtle border border-edge text-text-secondary font-mono font-medium tabular-nums">
                        {playlist.items.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {playlist.items.slice(0, 4).map((item, idx) => {
                        const task = taskMap.get(item.taskId);
                        return (
                          <span
                            key={item.id}
                            className="px-2 py-0.5 rounded-lg bg-surface-subtle border border-edge text-xs text-text-secondary truncate max-w-[130px]"
                          >
                            <span className="text-text-faint font-mono tabular-nums mr-1">{idx + 1}.</span>
                            {task ? task.name : `#${item.taskId}`}
                          </span>
                        );
                      })}
                      {playlist.items.length > 4 && (
                        <span className="px-2 py-0.5 rounded-lg bg-surface-subtle border border-edge text-xs text-text-faint font-mono tabular-nums">
                          +{playlist.items.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Recommended Sens Badge & Quick Apply */}
                    <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-edge">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-text-secondary">
                          {t("playlist.recommendedSens")}:
                        </span>
                        <span className="font-mono font-bold text-xs text-text-main tabular-nums">
                          {formatSensitivity(stats.displaySens.value, dpi)}
                        </span>
                        {isPredicted ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-soft text-emerald border border-emerald-edge">
                            PRED
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-surface-subtle text-text-faint border border-edge">
                            VISC
                          </span>
                        )}
                      </div>
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(stats.displaySens.value)}
                          className="press px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-subtle border border-edge hover:bg-surface-hover text-text-main transition-all shrink-0 cursor-pointer"
                          title={t("playlist.applySens")}
                        >
                          APPLY
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-edge">
                    <span className="text-xs text-text-faint tabular-nums">
                      {new Date(playlist.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => runner.start(playlist)}
                      className="press bg-score hover:brightness-105 text-primary-foreground font-semibold py-1.5 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
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
      <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-edge text-center max-w-lg mx-auto space-y-6 enter" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="w-16 h-16 rounded-full bg-emerald-soft border border-emerald-edge text-emerald mx-auto flex items-center justify-center">
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
          <h2 className="text-base font-semibold text-text-main font-sans">
            {t("runner.completed")}
          </h2>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            {t("runner.completedDesc")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={runner.restart}
            className="press w-full sm:w-auto bg-score hover:brightness-105 text-primary-foreground font-semibold py-2.5 px-5 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
          >
            RESTART
          </button>
          <button
            type="button"
            onClick={runner.stop}
            className="press w-full sm:w-auto bg-surface-subtle hover:bg-surface-hover text-text-main font-semibold py-2.5 px-5 rounded-xl text-xs border border-edge transition-all cursor-pointer"
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
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-edge flex items-center justify-between gap-4 enter" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-score-soft border border-score/30 text-score flex items-center justify-center shrink-0">
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
            <h2 className="text-sm font-semibold text-text-main truncate font-sans">
              {activePlaylist.name}
            </h2>
            <span className="text-xs text-text-secondary tabular-nums">
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
            className="press px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-subtle text-text-secondary hover:text-text-main border border-edge transition-all hidden sm:inline-block cursor-pointer"
          >
            EDIT
          </button>
          <button
            type="button"
            onClick={runner.stop}
            className="press px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-subtle text-text-faint hover:text-red hover:bg-red-soft border border-edge transition-all cursor-pointer"
          >
            EXIT
          </button>
        </div>
      </div>

      {/* Stepper Horizontal */}
      <div className="glass-panel p-4 rounded-2xl border border-edge enter" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {activePlaylist.items.map((item, index) => {
            const task = taskMap.get(item.taskId);
            const isCompleted = runner.completedStepIndices.has(index);
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs shrink-0 transition-all ${
                  isCurrent
                    ? "bg-score-soft text-score border-score/40 font-semibold shadow-xs"
                    : isCompleted
                    ? "bg-surface-subtle text-text-secondary border-edge opacity-80"
                    : "bg-surface text-text-faint border-edge opacity-50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono tabular-nums ${
                    isCurrent
                      ? "bg-score text-primary-foreground font-bold"
                      : isCompleted
                      ? "bg-emerald-soft text-emerald font-bold"
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
                <span className="truncate max-w-[120px]">
                  {task ? task.name : `#${item.taskId}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Scenario Card */}
      <div className="glass-panel p-5 sm:p-7 rounded-2xl border border-edge space-y-6 enter" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-edge pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-score">
              {t("runner.currentScenario")}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main mt-1 font-sans">
              {currentTask ? currentTask.name : `Task #${currentItem?.taskId}`}
            </h1>
            {currentTask && (
              <div className="flex items-center gap-2 text-xs text-text-secondary mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-surface-subtle border border-edge font-medium">
                  {currentTask.category}
                </span>
                <span className="text-text-faint">/</span>
                <span className="px-2 py-0.5 rounded-lg bg-surface-subtle border border-edge font-medium">
                  {currentTask.subcategory}
                </span>

                {recSens && (
                  <>
                    <span className="text-text-faint">/</span>
                    <div className="inline-flex items-center gap-1.5 pl-1.5 border-l border-edge">
                      <span className="text-text-secondary">{t("runner.scenarioSens")}:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-score-soft text-score border border-score/25 font-mono font-semibold flex items-center gap-1 tabular-nums">
                        <span>{recSens} cm</span>
                        {idealSens && (
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-normal">
                            {idealSens.source === "empirical" ? "EMP" : "VIS"}
                          </span>
                        )}
                      </span>
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(recSens)}
                          className="press px-2 py-0.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-all text-xs font-semibold cursor-pointer"
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
                    <span className="text-text-faint">/</span>
                    <div className="inline-flex items-center gap-1.5 pl-1.5 border-l border-edge">
                      <span className="text-text-secondary">{t("runner.playlistSens")}:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-accent/10 text-accent border border-accent/20 font-mono font-semibold tabular-nums">
                        {formatSensitivity(activePlaylistStats.displaySens.value, dpi)}
                      </span>
                      {isPlaylistPredicted ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-emerald-soft text-emerald border border-emerald-edge">
                          PRED
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-surface-subtle text-text-faint border border-edge">
                          VISC
                        </span>
                      )}
                      {onApplySens && (
                        <button
                          type="button"
                          onClick={() => void onApplySens(activePlaylistStats.displaySens.value)}
                          className="press px-2 py-0.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-all text-xs font-semibold cursor-pointer"
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

          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            {runner.currentStepIndex > 0 && (
              <button
                type="button"
                onClick={runner.previous}
                className="press bg-surface-subtle py-2 px-4 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main border border-edge transition-all cursor-pointer"
              >
                PREV
              </button>
            )}

            <button
              type="button"
              onClick={runner.next}
              className="press bg-score hover:brightness-105 text-primary-foreground font-semibold py-2 px-5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
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
            <span className="text-sm font-semibold text-text-main tabular-nums font-mono">
              {progressLabel}
            </span>
            <span className="font-mono text-xs font-semibold text-text-secondary tabular-nums">
              {Math.round(progressPercentage)}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-subtle border border-edge overflow-hidden">
            <div
              className="h-full bg-score rounded-full transition-all duration-300 ease-out"
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

