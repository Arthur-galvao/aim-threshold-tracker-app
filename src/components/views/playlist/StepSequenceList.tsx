import { useMemo } from "react";
import { Check, Play } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import type { PlaylistRunnerState } from "@/hooks/usePlaylistRunner";
import { useI18n } from "@/lib/i18n";

export interface StepSequenceListProps {
  runner: PlaylistRunnerState;
  tasks: Task[];
}

export function StepSequenceList({ runner, tasks }: StepSequenceListProps) {
  const { t } = useI18n();
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const { activePlaylist, currentStepIndex, completedStepIndices } = runner;
  if (!activePlaylist) return null;

  return (
    <div className="liquid-surface p-5 rounded-tile flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-edge">
        <h2 className="text-[13px] font-semibold text-text-secondary">
          {t("playlist.title")}
        </h2>
        <span className="text-[11px] font-mono text-text-faint tabular-nums">
          {completedStepIndices.size}/{activePlaylist.items.length} {t("runner.completed").toLowerCase()}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scroll-y space-y-1.5 pr-1 max-h-[380px]">
        {activePlaylist.items.map((item, index) => {
          const task = taskMap.get(item.taskId);
          const isCurrent = index === currentStepIndex;
          const isCompleted = completedStepIndices.has(index);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => runner.jumpToStep(index)}
              className={`w-full text-left p-2.5 rounded-control flex items-center justify-between gap-2.5 transition select-none cursor-pointer ${
                isCurrent
                  ? "liquid-well border-score/40 shadow-xs text-text-main"
                  : isCompleted
                  ? "liquid-well text-text-secondary hover:text-text-main"
                  : "liquid-well opacity-70 text-text-faint hover:text-text-main hover:opacity-100"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shrink-0 tabular-nums ${
                    isCurrent
                      ? "bg-score text-base shadow-xs"
                      : isCompleted
                      ? "bg-emerald-soft text-emerald"
                      : "bg-surface-subtle text-text-faint border border-edge"
                  }`}
                >
                  {isCompleted ? (
                    <Check size={11} weight="bold" />
                  ) : isCurrent ? (
                    <Play size={9} weight="fill" />
                  ) : (
                    index + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold truncate block">
                    {task ? task.name : `#${item.taskId}`}
                  </span>
                  {task && (
                    <span className="text-[10px] text-text-faint font-mono block">
                      {task.category}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono font-semibold text-text-faint px-1.5 py-0.5 rounded bg-surface-subtle shrink-0 tabular-nums">
                {item.targetValue}
                {item.targetMode === "reps" ? "r" : item.targetMode === "threshold" ? "r+T" : "s"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StepSequenceList;
