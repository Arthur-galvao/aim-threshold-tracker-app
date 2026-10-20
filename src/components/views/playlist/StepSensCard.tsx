import { useMemo } from "react";
import { Sliders } from "@phosphor-icons/react";
import { Button, Badge } from "@/components/ui";
import type { Playlist, Task } from "@/lib/types";
import { getRecommendedSens } from "@/lib/viscose";
import { getScenarioIdealSens } from "@/lib/sens-analytics";
import { useI18n } from "@/lib/i18n";

export interface StepSensCardProps {
  playlist: Playlist;
  tasks: Task[];
  mouseDpi?: number;
  onApplySens?: (sensCm: number, scenarioName?: string) => Promise<void> | void;
}

export function StepSensCard({
  playlist,
  tasks,
  mouseDpi = 800,
  onApplySens,
}: StepSensCardProps) {
  const { t } = useI18n();
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const stepDetails = useMemo(() => {
    return playlist.items.map((item, index) => {
      const task = taskMap.get(item.taskId);
      const idealSens = task ? getScenarioIdealSens(task, tasks, mouseDpi) : null;
      const recSens = idealSens
        ? idealSens.value
        : task
        ? getRecommendedSens(task.category, task.subcategory)
        : null;

      return {
        item,
        index,
        task,
        recSens,
        idealSource: idealSens?.source ?? "viscose",
      };
    });
  }, [playlist.items, taskMap, tasks, mouseDpi]);

  if (stepDetails.length === 0) return null;

  return (
    <div className="liquid-surface p-5 rounded-tile col-span-12 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-edge">
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("playlistSens.title")}
          </h2>
          <p className="text-xs text-text-faint mt-0.5">
            {t("playlistSens.subtitle")}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto scroll-y liquid-well rounded-control p-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">{t("task.active")}</th>
              <th className="py-2.5 px-3">{t("modal.category")}</th>
              <th className="py-2.5 px-3">{t("playlist.targetMode")}</th>
              <th className="py-2.5 px-3">{t("playlistSens.colRecommended")}</th>
              {onApplySens && <th className="py-2.5 px-3 text-right">{t("playlistSens.colActions")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {stepDetails.map(({ item, index, task, recSens, idealSource }) => (
              <tr key={item.id} className="hover:bg-surface-hover/40 transition">
                <td className="py-3 px-3 font-mono text-text-faint tabular-nums text-xs font-semibold">
                  {index + 1}
                </td>
                <td className="py-3 px-3 font-semibold text-text-main">
                  {task ? task.name : `#${item.taskId}`}
                </td>
                <td className="py-3 px-3 text-text-secondary font-mono text-[11px]">
                  {task ? `${task.category} / ${task.subcategory}` : "—"}
                </td>
                <td className="py-3 px-3 font-mono text-text-secondary tabular-nums text-xs">
                  {item.targetValue} {item.targetMode === "reps" ? "runs" : "seg"}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-text-main tabular-nums">
                      {recSens ? `${recSens.toFixed(1)} cm` : "—"}
                    </span>
                    {recSens && (
                      <Badge variant="neutral" className="uppercase font-mono text-[9px]">
                        {idealSource === "empirical" ? "EMP" : "VIS"}
                      </Badge>
                    )}
                  </div>
                </td>
                {onApplySens && (
                  <td className="py-3 px-3 text-right">
                    {recSens && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void onApplySens(recSens, task?.name)}
                        icon={<Sliders size={13} weight="bold" />}
                      >
                        {t("playlist.applySens")}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StepSensCard;
