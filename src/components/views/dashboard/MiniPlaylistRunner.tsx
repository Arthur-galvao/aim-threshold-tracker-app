import { useMemo, useState } from "react";
import {
  Play,
  Check,
  CaretLeft,
  CaretRight,
  X,
  ArrowCounterClockwise,
  Queue,
} from "@phosphor-icons/react";
import { useApp } from "@/hooks/useAppData";
import { useI18n } from "@/lib/i18n";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface MiniPlaylistRunnerProps {
  className?: string;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MiniPlaylistRunner({ className }: MiniPlaylistRunnerProps) {
  const { t } = useI18n();
  const { appData, playlistRunner } = useApp();
  const {
    activePlaylist,
    currentStepIndex,
    currentItem,
    currentTask,
    isRunning,
    isFinished,
    start,
    next,
    previous,
    stop,
    restart,
    sessionCountAtStart,
    stepTargetThreshold,
    stepBestScore,
    elapsedSeconds,
  } = playlistRunner;

  const playlists = appData.playlists ?? [];
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    playlists[0]?.id ?? ""
  );

  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0] ?? null;
  }, [playlists, selectedPlaylistId]);

  const progressData = useMemo(() => {
    if (!currentItem) return { percentage: 0, label: "" };

    if (currentItem.targetMode === "reps") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - sessionCountAtStart);
      const targetReps = currentItem.targetValue;
      const percentage = Math.min(100, (completedReps / targetReps) * 100);
      const label = `${completedReps}/${targetReps} runs`;
      return { percentage, label };
    } else if (currentItem.targetMode === "threshold") {
      const currentSessions = currentTask ? currentTask.sessions.length : 0;
      const completedReps = Math.max(0, currentSessions - sessionCountAtStart);
      const targetReps = Math.max(1, currentItem.targetValue);
      const threshVal = stepTargetThreshold ?? 0;
      const bestVal = stepBestScore ?? 0;
      const scoreRatio = threshVal > 0 ? Math.min(1, bestVal / threshVal) : completedReps >= targetReps ? 1 : 0;
      const repRatio = Math.min(1, completedReps / targetReps);
      const percentage = Math.min(100, ((scoreRatio + repRatio) / 2) * 100);
      const label =
        threshVal > 0
          ? `${bestVal}/${threshVal} pts (${completedReps}/${targetReps}r)`
          : `${completedReps}/${targetReps} runs`;
      return { percentage, label };
    } else {
      const elapsed = elapsedSeconds;
      const target = currentItem.targetValue;
      const percentage = Math.min(100, (elapsed / target) * 100);
      const label = `${formatDuration(elapsed)} / ${formatDuration(target)}`;
      return { percentage, label };
    }
  }, [currentItem, currentTask, sessionCountAtStart, stepTargetThreshold, stepBestScore, elapsedSeconds]);

  // 1. Finished State
  if (isFinished && activePlaylist) {
    return (
      <div
        className={cn(
          "glass p-4 border-emerald-edge flex flex-col sm:flex-row items-center justify-between gap-3",
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-soft text-emerald border border-emerald-edge flex items-center justify-center shrink-0">
            <Check size={16} weight="bold" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-text-main flex items-center gap-2">
              <span>{t("runner.completed")}</span>
              <span className="text-[11px] font-normal text-text-secondary">
                ({activePlaylist.name})
              </span>
            </div>
            <p className="text-[11px] text-text-faint">{t("runner.completedDesc")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="primary"
            onClick={restart}
            icon={<ArrowCounterClockwise size={13} weight="bold" />}
          >
            {t("runner.restart")}
          </Button>
          <Button size="sm" variant="secondary" onClick={stop}>
            {t("modal.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // 2. Active Running State
  if (isRunning && activePlaylist) {
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === activePlaylist.items.length - 1;

    return (
      <div className={cn("glass p-4 border-score/30 space-y-2.5", className)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Playlist & Step Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shrink-0">
              <Play size={14} weight="fill" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-text-main truncate max-w-[200px]" title={activePlaylist.name}>
                  {activePlaylist.name}
                </span>
                <Badge variant="score">
                  {t("runner.progress", {
                    current: currentStepIndex + 1,
                    total: activePlaylist.items.length,
                  })}
                </Badge>
              </div>
              <div className="text-[11px] text-text-secondary truncate mt-0.5">
                <span>{currentTask ? currentTask.name : "Cenário"}</span>
              </div>
            </div>
          </div>

          {/* Right: Progress Metric & Controls */}
          <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0 w-full sm:w-auto">
            <span className="px-2.5 py-1 rounded-control bg-surface-subtle border border-edge text-[11px] font-mono text-text-main tabular">
              {progressData.label}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={previous}
                disabled={isFirstStep}
                title={t("runner.previous")}
                aria-label={t("runner.previous")}
                className="p-1.5 rounded-control border border-edge text-text-secondary hover:text-text-main hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer press"
              >
                <CaretLeft size={13} weight="bold" />
              </button>

              <Button
                size="sm"
                variant="primary"
                onClick={next}
                className="h-7 px-2.5 text-xs press"
              >
                <span>{isLastStep ? t("runner.finish") : t("runner.next")}</span>
                <CaretRight size={12} weight="bold" className="ml-1" />
              </Button>

              <button
                type="button"
                onClick={stop}
                title={t("runner.exit")}
                aria-label={t("runner.exit")}
                className="p-1.5 rounded-control border border-edge text-text-faint hover:text-red hover:bg-red-soft transition-colors cursor-pointer press"
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

  // 3. Idle / Standby State (Compact pill bar; hidden when no playlists exist)
  if (playlists.length === 0 || !selectedPlaylist) {
    return null;
  }

  return (
    <div
      className={cn(
        "liquid-surface px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full liquid-well text-score flex items-center justify-center shrink-0">
          <Queue size={15} weight="regular" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xs font-semibold text-text-main">
            {t("dashboard.miniRunnerTitle")}
          </h3>
          <span className="text-[11px] text-text-faint font-mono">
            ({playlists.length})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selectedPlaylist.id}
          onChange={(e) => setSelectedPlaylistId(e.target.value)}
          aria-label={t("dashboard.miniRunnerTitle")}
          className="h-8 px-3 text-xs font-mono rounded-full field w-auto"
        >
          {playlists.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name} ({pl.items.length})
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="primary"
          onClick={() => start(selectedPlaylist)}
          icon={<Play size={12} weight="fill" />}
          className="rounded-full"
        >
          {t("dashboard.miniRunnerStart")}
        </Button>
      </div>
    </div>
  );
}
