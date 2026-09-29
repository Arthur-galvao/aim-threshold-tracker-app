import { useMemo } from "react";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";
import { useI18n } from "@/lib/i18n";

interface DashboardPlaylistRunnerProps {
  runner: PlaylistRunnerState;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function DashboardPlaylistRunner({ runner }: DashboardPlaylistRunnerProps) {
  const { t } = useI18n();

  const { activePlaylist, currentStepIndex, currentItem, currentTask, isRunning, isFinished } = runner;

  const progressData = useMemo(() => {
    if (!currentItem) return { percentage: 0, label: "" };

    if (currentItem.targetMode === "reps") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - runner.sessionCountAtStart);
      const targetReps = currentItem.targetValue;
      const percentage = Math.min(100, (completedReps / targetReps) * 100);
      const label = `${completedReps}/${targetReps} runs`;
      return { percentage, label };
    } else {
      const elapsed = runner.elapsedSeconds;
      const target = currentItem.targetValue;
      const percentage = Math.min(100, (elapsed / target) * 100);
      const label = `${formatDuration(elapsed)} / ${formatDuration(target)}`;
      return { percentage, label };
    }
  }, [currentItem, currentTask, runner.sessionCountAtStart, runner.elapsedSeconds]);

  if (!activePlaylist || (!isRunning && !isFinished)) {
    return null;
  }

  if (isFinished) {
    return (
      <div className="panel p-4 rounded-2xl border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4"
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
          <div className="min-w-0">
            <div className="text-xs font-bold text-text-main flex items-center gap-2">
              <span>{t("runner.completed")}</span>
              <span className="text-[11px] font-normal text-text-secondary">({activePlaylist.name})</span>
            </div>
            <p className="text-[11px] text-text-faint">{t("runner.completedDesc")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={runner.restart}
            className="minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all shadow-sm"
          >
            {t("runner.restart")}
          </button>
          <button
            type="button"
            onClick={runner.stop}
            className="minimal-btn-secondary py-1.5 px-3 rounded-lg text-xs font-medium text-text-secondary hover:text-text-main border-edge"
          >
            {t("modal.cancel")}
          </button>
        </div>
      </div>
    );
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === activePlaylist.items.length - 1;

  return (
    <div className="panel p-3.5 sm:p-4 rounded-2xl border-blue-500/30 bg-blue-500/5 shadow-xs space-y-2.5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Playlist & Step Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-text-main truncate max-w-[200px]" title={activePlaylist.name}>
                {activePlaylist.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono">
                {t("runner.progress", {
                  current: currentStepIndex + 1,
                  total: activePlaylist.items.length,
                })}
              </span>
            </div>
            <div className="text-[11px] text-text-secondary truncate mt-0.5">
              {currentTask ? currentTask.name : "Cenário"}
            </div>
          </div>
        </div>

        {/* Right: Progress Metric & Controls */}
        <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
          <div className="px-2.5 py-1 rounded-lg bg-surface border border-edge text-[11px] font-mono text-text-main tabular-nums">
            {progressData.label}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={runner.previous}
              disabled={isFirstStep}
              title={t("runner.previous")}
              className="p-1.5 rounded-lg border border-edge text-text-secondary hover:text-text-main hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={runner.next}
              title={isLastStep ? t("runner.finish") : t("runner.next")}
              className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs flex items-center gap-1 shadow-xs transition-all"
            >
              <span>{isLastStep ? t("runner.finish") : t("runner.next")}</span>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={runner.stop}
              title={t("runner.exit")}
              className="px-2 py-1 rounded-lg border border-edge text-text-faint hover:text-red hover:bg-red-500/10 text-xs font-medium transition-colors"
            >
              {t("runner.exit")}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-subtle border border-edge rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressData.percentage}%` }}
        />
      </div>
    </div>
  );
}
