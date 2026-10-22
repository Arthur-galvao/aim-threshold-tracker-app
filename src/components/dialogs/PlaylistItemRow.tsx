import { ArrowUp, ArrowDown, Trash } from "@phosphor-icons/react";
import { Input } from "@/components/ui";
import type { PlaylistItem, Task } from "@/lib/types";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

export interface PlaylistItemRowProps {
  item: PlaylistItem;
  index: number;
  total: number;
  task?: Task;
  onMove: (index: number, direction: "up" | "down") => void;
  onUpdate: (
    index: number,
    partial: Partial<Pick<PlaylistItem, "targetMode" | "targetValue">>
  ) => void;
  onRemove: (index: number) => void;
}

export function PlaylistItemRow({
  item,
  index,
  total,
  task,
  onMove,
  onUpdate,
  onRemove,
}: PlaylistItemRowProps) {
  const { t } = useI18n();
  const recSens = task ? getRecommendedSens(task.category, task.subcategory) : null;

  return (
    <div className="p-2.5 rounded-control bg-surface border border-edge flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, "up")}
            className="text-text-faint hover:text-text-main disabled:opacity-20 cursor-pointer p-0.5"
            title={t("playlist.up")}
          >
            <ArrowUp size={11} weight="bold" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, "down")}
            className="text-text-faint hover:text-text-main disabled:opacity-20 cursor-pointer p-0.5"
            title={t("playlist.down")}
          >
            <ArrowDown size={11} weight="bold" />
          </button>
        </div>

        <span className="w-5 h-5 rounded-full bg-surface-subtle border border-edge text-[10px] font-mono flex items-center justify-center text-text-faint shrink-0 tabular-nums font-semibold">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-text-main truncate block font-sans">
            {task ? task.name : `#${item.taskId}`}
          </span>
          {task && (
            <span className="text-[10px] text-text-faint font-mono block">
              {task.category} · {task.subcategory}
              {recSens ? ` · ${recSens}cm` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <div className="flex items-center glass-inset p-0.5 rounded-control">
          <button
            type="button"
            onClick={() =>
              onUpdate(index, {
                targetMode: "reps",
                targetValue: item.targetMode === "reps" ? item.targetValue : 5,
              })
            }
            className={`px-2 py-0.5 rounded-control text-[10px] font-mono font-semibold transition ${
              item.targetMode === "reps"
                ? "bg-score text-base shadow-xs"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            {t("playlist.repsUnit")}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate(index, {
                targetMode: "time",
                targetValue: item.targetMode === "time" ? item.targetValue : 120,
              })
            }
            className={`px-2 py-0.5 rounded-control text-[10px] font-mono font-semibold transition ${
              item.targetMode === "time"
                ? "bg-score text-base shadow-xs"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            {t("playlist.timeUnit")}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate(index, {
                targetMode: "threshold",
                targetValue: item.targetMode === "threshold" ? item.targetValue : 1,
              })
            }
            className={`px-2 py-0.5 rounded-control text-[10px] font-mono font-semibold transition ${
              item.targetMode === "threshold"
                ? "bg-score text-base shadow-xs"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            {t("playlist.modeThreshold")}
          </button>
        </div>

        <Input
          type="number"
          min="1"
          max={item.targetMode === "time" ? 3600 : 100}
          value={item.targetValue}
          onChange={(e) => {
            const val = Math.max(1, parseInt(e.target.value) || 1);
            onUpdate(index, { targetValue: val });
          }}
          className="w-16 font-mono text-xs text-center tabular-nums py-0.5 px-1.5"
        />

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-text-faint hover:text-red p-1 rounded transition ml-1"
          title={t("playlist.removeItem")}
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
