import { useMemo } from "react";
import { Play, Check, CaretLeft, CaretRight, X, ArrowCounterClockwise } from "@phosphor-icons/react";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";
import type { Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { getRecommendedSens } from "@/lib/viscose";
import { getScenarioIdealSens } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";

interface DashboardPlaylistRunnerProps {
  runner: PlaylistRunnerState;
  tasks?: Task[];
  mouseDpi?: number;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function DashboardPlaylistRunner({ runner, tasks, mouseDpi }: DashboardPlaylistRunnerProps) {
  const { t } = useI18n();
  const dpi = mouseDpi || 800;

  const { activePlaylist, currentStepIndex, currentItem, currentTask, isRunning, isFinished } = runner;

  const idealSens = currentTask ? getScenarioIdealSens(currentTask, tasks, dpi) : null;
  const recSens = idealSens ? idealSens.value : (currentTask ? getRecommendedSens(currentTask.category, currentTask.subcategory) : null);

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
      <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-edge bg-emerald-soft/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-soft text-emerald border border-emerald-edge flex items-center justify-center shrink-0">
            <Check size={16} weight="bold" />
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
          <Button
            size="sm"
            variant="primary"
            onClick={runner.restart}
            icon={<ArrowCounterClockwise size={13} weight="bold" />}
            className="press"
          >
            {t("runner.restart")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={runner.stop}
            className="press"
          >
            {t("modal.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === activePlaylist.items.length - 1;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl glass-panel border border-score/30 shadow-xs space-y-2.5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Playlist & Step Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-score-soft text-score border border-score/30 flex items-center justify-center shrink-0">
            <Play size={14} weight="bold" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-text-main truncate max-w-[200px]" title={activePlaylist.name}>
                {activePlaylist.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-score-soft border border-score/20 text-score font-mono tabular-nums">
                {t("runner.progress", {
                  current: currentStepIndex + 1,
                  total: activePlaylist.items.length,
                })}
              </span>
            </div>
            <div className="text-[11px] text-text-secondary truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{currentTask ? currentTask.name : "Cenário"}</span>
              {idealSens && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-score border border-edge font-mono font-medium flex items-center gap-1 tabular-nums"
                  title={idealSens.source === "empirical" ? t("randomizer.idealSensSourceEmpirical") : t("randomizer.idealSensSourceViscose")}
                >
                  <span>{recSens} cm</span>
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-normal">
                    {idealSens.source === "empirical" ? "EMP" : "VIS"}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Progress Metric & Controls */}
        <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0 w-full sm:w-auto">
          <div className="px-2.5 py-1 rounded-lg bg-surface border border-edge text-[11px] font-mono text-text-main tabular-nums">
            {progressData.label}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={runner.previous}
              disabled={isFirstStep}
              title={t("runner.previous")}
              className="p-1.5 rounded-lg border border-edge text-text-secondary hover:text-text-main hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer press"
            >
              <CaretLeft size={13} weight="bold" />
            </button>

            <Button
              size="sm"
              variant="primary"
              onClick={runner.next}
              title={isLastStep ? t("runner.finish") : t("runner.next")}
              className="h-7 px-2.5 text-xs press"
            >
              <span>{isLastStep ? t("runner.finish") : t("runner.next")}</span>
              <CaretRight size={12} weight="bold" className="ml-1" />
            </Button>

            <button
              type="button"
              onClick={runner.stop}
              title={t("runner.exit")}
              className="p-1.5 rounded-lg border border-edge text-text-faint hover:text-red hover:bg-red-soft transition-colors cursor-pointer press"
            >
              <X size={13} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-subtle border border-edge rounded-full h-1 overflow-hidden">
        <div
          className="bg-score h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressData.percentage}%` }}
        />
      </div>
    </div>
  );
}
