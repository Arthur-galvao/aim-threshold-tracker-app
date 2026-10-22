import { useMemo } from "react";
import {
  CaretLeft,
  CaretRight,
  Check,
  FastForward,
  X,
  Crosshair,
  Sliders,
  ShieldCheck,
  Eye,
} from "@phosphor-icons/react";
import { Button, Badge } from "@/components/ui";
import type { Task } from "@/lib/types";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";
import { getRecommendedSens, getSubcategoryCoachingCue } from "@/lib/viscose";
import {
  formatSensitivity,
  getScenarioIdealSens,
  type PlaylistSensStats,
} from "@/lib/sens-analytics";
import { useI18n } from "@/lib/i18n";

export interface ActiveRunnerStepProps {
  runner: PlaylistRunnerState;
  tasks: Task[];
  mouseDpi?: number;
  playlistStats?: PlaylistSensStats | null;
  onApplySens?: (sensCm: number, scenarioName?: string) => Promise<void> | void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ActiveRunnerStep({
  runner,
  tasks,
  mouseDpi = 800,
  playlistStats,
  onApplySens,
}: ActiveRunnerStepProps) {
  const { t } = useI18n();
  const {
    activePlaylist,
    currentStepIndex,
    currentItem,
    currentTask,
    stepTargetThreshold,
    stepBestScore,
  } = runner;

  const totalSteps = activePlaylist?.items.length ?? 0;
  const isLastStep = currentStepIndex >= totalSteps - 1;

  const idealSens = useMemo(() => {
    if (!currentTask) return null;
    return getScenarioIdealSens(currentTask, tasks, mouseDpi);
  }, [currentTask, tasks, mouseDpi]);

  const recSens = idealSens
    ? idealSens.value
    : currentTask
    ? getRecommendedSens(currentTask.category, currentTask.subcategory)
    : null;

  const coachingCue = useMemo(() => {
    if (!currentTask) return null;
    return getSubcategoryCoachingCue(currentTask.category, currentTask.subcategory);
  }, [currentTask]);

  // Calculate step progress
  let progressPct = 0;
  let progressLabel = "";

  if (currentItem) {
    if (currentItem.targetMode === "reps") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - runner.sessionCountAtStart);
      const targetReps = currentItem.targetValue;
      progressPct = Math.min(100, (completedReps / targetReps) * 100);
      progressLabel = t("runner.goalReps", {
        current: completedReps,
        target: targetReps,
      });
    } else if (currentItem.targetMode === "threshold") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - runner.sessionCountAtStart);
      const targetReps = Math.max(1, currentItem.targetValue);
      const threshVal = stepTargetThreshold ?? 0;
      const bestVal = stepBestScore ?? 0;
      const scoreRatio = threshVal > 0 ? Math.min(1, bestVal / threshVal) : completedReps >= targetReps ? 1 : 0;
      const repRatio = Math.min(1, completedReps / targetReps);
      progressPct = Math.min(100, ((scoreRatio + repRatio) / 2) * 100);
      progressLabel = t("runner.goalThreshold", {
        best: bestVal,
        threshold: threshVal > 0 ? threshVal : "—",
        current: completedReps,
        target: targetReps,
      });
    } else {
      const elapsed = runner.elapsedSeconds;
      const target = currentItem.targetValue;
      progressPct = Math.min(100, (elapsed / target) * 100);
      const remaining = Math.max(0, target - elapsed);
      progressLabel = t("runner.goalTime", {
        remaining: formatDuration(remaining),
        current: elapsed,
        target,
      });
    }
  }

  return (
    <div className="liquid-surface p-6 rounded-tile flex flex-col justify-between gap-5">
      {/* Step Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="score" className="font-mono tabular-nums font-bold">
              {t("runner.progress", {
                current: currentStepIndex + 1,
                total: totalSteps,
              })}
            </Badge>
            <span className="text-xs text-text-faint font-medium">
              {activePlaylist?.name}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={runner.stop}
            icon={<X size={14} weight="bold" />}
            className="text-text-faint hover:text-red hover:bg-red-soft"
          >
            {t("runner.exit")}
          </Button>
        </div>

        {/* Big Scenario Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main font-sans tracking-tight">
          {currentTask ? currentTask.name : `Task #${currentItem?.taskId}`}
        </h1>

        {/* Category & Subcategory tags */}
        {currentTask && (
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <Badge variant="neutral">
              {currentTask.category}
            </Badge>
            <Badge variant="neutral">
              {currentTask.subcategory}
            </Badge>
          </div>
        )}
      </div>

      {/* Telemetry & Sensitivity Cards for this Step */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Scenario Target Threshold */}
        <div className="liquid-well p-3.5 flex flex-col justify-between gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <ShieldCheck size={13} weight="bold" className="text-emerald" />
            <span>{t("runner.thresholdCardTitle")}</span>
          </span>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="font-mono text-lg font-bold text-text-main tabular-nums">
              {stepTargetThreshold !== null ? `${stepTargetThreshold} pts` : t("runner.noTargetYet")}
            </span>
            {stepBestScore !== null && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border tabular-nums ${
                  stepTargetThreshold !== null && stepBestScore >= stepTargetThreshold
                    ? "text-emerald bg-emerald-soft border-emerald-edge"
                    : "text-text-secondary bg-surface-subtle border-edge"
                }`}
              >
                {t("runner.stepBestScore", { score: stepBestScore })}
              </span>
            )}
          </div>
        </div>

        {/* Scenario Ideal Sens */}
        <div className="liquid-well p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint flex items-center gap-1.5 block">
              <Crosshair size={13} weight="bold" className="text-score" />
              <span>{t("runner.scenarioSens")}</span>
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-lg font-bold text-text-main tabular-nums">
                {recSens ? `${recSens.toFixed(1)} cm` : "—"}
              </span>
              {idealSens && (
                <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-surface-subtle text-text-faint border border-edge">
                  {idealSens.source === "empirical" ? "EMP" : "VIS"}
                </span>
              )}
            </div>
          </div>

          {recSens && onApplySens && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onApplySens(recSens, currentTask?.name)}
              icon={<Sliders size={13} weight="bold" />}
            >
              {t("runner.applySens")}
            </Button>
          )}
        </div>

        {/* Playlist Average Sens */}
        <div className="liquid-well p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-faint flex items-center gap-1.5 block">
              <Crosshair size={13} weight="bold" className="text-emerald" />
              <span>{t("runner.playlistSens")}</span>
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-lg font-bold text-text-main tabular-nums">
                {playlistStats
                  ? formatSensitivity(playlistStats.displaySens.value, mouseDpi)
                  : "—"}
              </span>
              {playlistStats && (
                <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-surface-subtle text-text-faint border border-edge">
                  {playlistStats.displaySens.source === "predicted" ? "PRED" : "AVG"}
                </span>
              )}
            </div>
          </div>

          {playlistStats && onApplySens && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onApplySens(playlistStats.displaySens.value)}
              icon={<Sliders size={13} weight="bold" />}
            >
              {t("runner.applySens")}
            </Button>
          )}
        </div>
      </div>

      {/* Biomechanical & Quiet Eye Directive */}
      {coachingCue && (
        <div className="liquid-well p-3.5 rounded-control border border-edge space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-score">
            <Eye size={13} weight="bold" />
            <span>{t("coach.title")}</span>
          </div>
          <p className="text-xs text-text-main leading-relaxed">
            {t(coachingCue.mechanicKey)}
          </p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-main">{t("coach.quietEye")}:</span>{" "}
            {t(coachingCue.quietEyeKey)}
          </p>
        </div>
      )}

      {/* Target Progress Bar & Controls */}
      <div className="space-y-4 pt-2 border-t border-edge">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-main font-mono tabular-nums">
              {progressLabel}
            </span>
            <span className="font-mono text-xs font-bold text-text-secondary tabular-nums">
              {Math.round(progressPct)}%
            </span>
          </div>

          {/* Clean Progress bar */}
          <div className="w-full h-2 rounded-full bg-surface border border-edge overflow-hidden">
            <div
              className="h-full bg-score rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[11px] text-text-faint">
            {t("runner.autoAdvanceNote")}
          </p>
        </div>

        {/* Runner Actions */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={currentStepIndex === 0}
            onClick={runner.previous}
            icon={<CaretLeft size={16} weight="bold" />}
          >
            {t("runner.previous")}
          </Button>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={runner.next}
                icon={<FastForward size={14} weight="bold" />}
              >
                {t("runner.skip")}
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={runner.next}
              icon={
                isLastStep ? (
                  <Check size={16} weight="bold" />
                ) : (
                  <CaretRight size={16} weight="bold" />
                )
              }
              iconPosition="right"
            >
              {isLastStep ? t("runner.finish") : t("runner.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActiveRunnerStep;
