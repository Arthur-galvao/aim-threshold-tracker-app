import { useMemo } from "react";
import { Sliders } from "@phosphor-icons/react";
import { Button, Badge } from "@/components/ui";
import type { Playlist, Task } from "@/lib/types";
import type {
  RandomizerActiveRole,
  RandomizerMuscleCue,
} from "@/hooks/useSensRandomizer";
import { getRecommendedSens } from "@/lib/viscose";
import { getScenarioIdealSens } from "@/lib/sens-analytics";
import { muscleCueFor } from "@/lib/playlist-step";
import { useI18n } from "@/lib/i18n";

/** Estado do randomizer exibido no card (T5.7e). */
export interface StepRandomizerInfo {
  sensCm: number;
  centerCm: number | null;
  role: RandomizerActiveRole | null;
  muscleCue: RandomizerMuscleCue | null;
}

export interface StepSensCardProps {
  playlist: Playlist;
  tasks: Task[];
  mouseDpi?: number;
  onApplySens?: (sensCm: number, scenarioName?: string) => Promise<void> | void;
  /** Passo em execução (destacado na tabela). */
  activeIndex?: number | null;
  randomizer?: StepRandomizerInfo | null;
  /** Meta do passo ativo na sens atual (T·exp(b·Δ²)). */
  activeTarget?: number | null;
  /** Cue de intenção do passo ativo (T7.7). */
  activeIntentCue?: string | null;
}

export function StepSensCard({
  playlist,
  tasks,
  mouseDpi = 800,
  onApplySens,
  activeIndex = null,
  randomizer = null,
  activeTarget = null,
  activeIntentCue = null,
}: StepSensCardProps) {
  const { t } = useI18n();
  // Chaves novas vivem em docs/plans/i18n-pending/T7-playlist.json até a integração (o tipo Key ainda não as conhece).
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

  const roleLabel = randomizer?.role
    ? {
        base: t("playlistSens.roleBase"),
        anchor: t("playlistSens.roleAnchor"),
        random: t("playlistSens.roleRandom"),
        off: t("playlistSens.roleOff"),
      }[randomizer.role]
    : null;

  const cue =
    randomizer?.muscleCue ??
    (randomizer && randomizer.centerCm ? muscleCueFor(randomizer.sensCm, randomizer.centerCm) : null);
  const cueLabel = cue
    ? {
        fast: t("playlistSens.cueFast"),
        slow: t("playlistSens.cueSlow"),
        base: t("playlistSens.cueBase"),
      }[cue]
    : null;

  return (
    <div className="liquid-surface p-5 rounded-tile col-span-12 space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-edge">
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("playlistSens.title")}
          </h2>
          <p className="text-xs text-text-faint mt-0.5">
            {t("playlistSens.subtitle")}
          </p>
        </div>

        {randomizer && randomizer.sensCm > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="score" className="font-mono tabular-nums">
              {t("playlistSens.chipSens", { sens: randomizer.sensCm.toFixed(2) })}
            </Badge>
            {roleLabel && <Badge variant="neutral">{roleLabel}</Badge>}
            {cueLabel && <Badge variant="neutral">{cueLabel}</Badge>}
            {activeTarget !== null && (
              <span className="text-[11px] font-mono text-text-secondary tabular-nums">
                {t("playlistSens.targetHere", { target: Math.round(activeTarget) })}
              </span>
            )}
          </div>
        )}
      </div>

      {activeIntentCue && activeIndex !== null && (
        <p className="text-[11px] text-text-faint">
          {t("intent.label")}: <span className="text-text-main">{activeIntentCue}</span>
        </p>
      )}

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
              <tr
                key={item.id}
                className={
                  index === activeIndex
                    ? "bg-score-soft"
                    : "hover:bg-surface-hover/40 transition"
                }
              >
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
