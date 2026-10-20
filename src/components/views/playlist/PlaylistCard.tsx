import { useMemo } from "react";
import { Play, PencilSimple, Trash, Crosshair } from "@phosphor-icons/react";
import { Button, Badge } from "@/components/ui";
import type { Playlist, Task } from "@/lib/types";
import {
  computePlaylistSensStats,
  formatSensitivity,
} from "@/lib/sens-analytics";
import { useI18n } from "@/lib/i18n";

export interface PlaylistCardProps {
  playlist: Playlist;
  tasks: Task[];
  mouseDpi?: number;
  onStart: (playlist: Playlist) => void;
  onEdit: (playlist: Playlist) => void;
  onDelete?: (id: string) => void;
}

export function PlaylistCard({
  playlist,
  tasks,
  mouseDpi = 800,
  onStart,
  onEdit,
  onDelete,
}: PlaylistCardProps) {
  const { t } = useI18n();
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const stats = useMemo(() => {
    return computePlaylistSensStats(playlist, tasks, "equilibrado", mouseDpi);
  }, [playlist, tasks, mouseDpi]);

  return (
    <div className="liquid-surface lift p-5 rounded-tile flex flex-col justify-between gap-4 h-full shadow-1 hover:border-edge-strong transition">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-text-main font-sans truncate">
            {playlist.name}
          </h3>
          <Badge variant="neutral" className="font-mono tabular-nums">
            {playlist.items.length} {t("playlist.repsUnit")}
          </Badge>
        </div>

        {/* Recommended Sens Banner */}
        <div className="liquid-well p-2.5 rounded-control flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Crosshair size={13} weight="bold" className="text-score shrink-0" />
            <span className="text-[11px] font-semibold text-text-faint uppercase">
              {t("playlist.recommendedSens")}:
            </span>
          </div>
          <span className="font-mono font-bold text-xs text-text-main tabular-nums">
            {formatSensitivity(stats.displaySens.value, mouseDpi)}
          </span>
        </div>

        {/* Scenario chips preview */}
        <div className="flex flex-wrap gap-1.5">
          {playlist.items.slice(0, 4).map((item, idx) => {
            const task = taskMap.get(item.taskId);
            return (
              <span
                key={item.id}
                className="px-2 py-0.5 rounded-control bg-surface-subtle border border-edge text-[11px] text-text-secondary truncate max-w-[140px]"
              >
                <span className="text-text-faint font-mono mr-1 tabular-nums">{idx + 1}.</span>
                {task ? task.name : `#${item.taskId}`}
              </span>
            );
          })}
          {playlist.items.length > 4 && (
            <span className="px-2 py-0.5 rounded-control bg-surface-subtle border border-edge text-[11px] text-text-faint font-mono tabular-nums">
              +{playlist.items.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-edge">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onEdit(playlist)}
            icon={<PencilSimple size={13} weight="bold" />}
          >
            {t("playlist.edit")}
          </Button>

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`${t("playlist.delete")} "${playlist.name}"?`)) {
                  onDelete(playlist.id);
                }
              }}
              className="p-1.5 text-text-faint hover:text-red hover:bg-red-soft rounded-control transition cursor-pointer"
              title={t("playlist.delete")}
            >
              <Trash size={14} weight="bold" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onStart(playlist)}
          icon={<Play size={13} weight="fill" />}
        >
          {t("playlist.start")}
        </Button>
      </div>
    </div>
  );
}

export default PlaylistCard;
