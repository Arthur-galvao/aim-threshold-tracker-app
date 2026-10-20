import { useState, useMemo } from "react";
import { ChartLineUp, Check, Folder } from "@phosphor-icons/react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n, type Key } from "@/lib/i18n";
import {
  DEFAULT_CATEGORY,
  DEFAULT_SUBCATEGORY,
  getDisplaySens,
  getRecommendedSens,
} from "@/lib/viscose";
import {
  computePlaylistSensStats,
  predictOptimalSensitivity,
  type PlaylistSensStats,
  type RunDataPoint,
} from "@/lib/sens-analytics";
import { buildRunPoints } from "@/lib/run-points";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";

export interface CategoryCardsProps {
  tasks: Task[];
  playlists?: Playlist[];
  mouseDpi?: number;
  onApplySens?: (sensCm: number, targetScenarios?: string[]) => Promise<void>;
  onViewInChart?: (filter: { mode: "category" | "playlist"; id: string }) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface CategoryGroupItem {
  key: string;
  category: string;
  subcategory: string;
  taskNames: string[];
  scenariosCount: number;
  totalRuns: number;
  displaySens: { value: number; source: "predicted" | "viscose" };
  viscoseSens: number | null;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export function CategoryCards({
  tasks,
  playlists = [],
  mouseDpi = 800,
  onApplySens,
  onViewInChart,
  className,
  style,
}: CategoryCardsProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"category" | "playlist">("category");

  const categoryGroups = useMemo<CategoryGroupItem[]>(() => {
    const map = new Map<
      string,
      {
        category: string;
        subcategory: string;
        taskNames: Set<string>;
        runs: RunDataPoint[];
      }
    >();

    const runPoints = buildRunPoints(tasks, { dpi: mouseDpi });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    for (const p of runPoints) {
      const task = taskMap.get(p.taskId);
      const category = task?.category || DEFAULT_CATEGORY;
      const subcategory = task?.subcategory || DEFAULT_SUBCATEGORY;
      const groupKey = `${category}__${subcategory}`;

      let group = map.get(groupKey);
      if (!group) {
        group = {
          category,
          subcategory,
          taskNames: new Set<string>(),
          runs: [],
        };
        map.set(groupKey, group);
      }

      group.taskNames.add(p.scenario);
      group.runs.push({
        scenario: p.scenario,
        sens: p.sens,
        score: p.rel,
        rawScore: p.score,
        normScore: p.rel,
        threshold: p.threshold,
        date: p.date,
      });
    }

    const items: CategoryGroupItem[] = [];

    for (const [key, group] of map.entries()) {
      const displaySens = getDisplaySens(
        group.category,
        group.subcategory,
        group.runs
      );
      const viscoseSens = getRecommendedSens(group.category, group.subcategory);

      let confidence: "high" | "medium" | "low" | "insufficient" = "insufficient";
      if (group.runs.length > 0) {
        const pred = predictOptimalSensitivity([], "equilibrado", {
          groupRuns: group.runs,
        });
        if (pred) {
          confidence = pred.confidence;
        }
      }

      items.push({
        key,
        category: group.category,
        subcategory: group.subcategory,
        taskNames: Array.from(group.taskNames),
        scenariosCount: group.taskNames.size,
        totalRuns: group.runs.length,
        displaySens,
        viscoseSens,
        confidence,
      });
    }

    return items.sort((a, b) => b.totalRuns - a.totalRuns);
  }, [tasks, mouseDpi]);

  const playlistStatsList = useMemo<PlaylistSensStats[]>(() => {
    return playlists.map((pl) => computePlaylistSensStats(pl, tasks, "equilibrado", mouseDpi));
  }, [playlists, tasks, mouseDpi]);

  const getConfidenceBadge = (confidence: "high" | "medium" | "low" | "insufficient") => {
    const map: Record<string, { variant: BadgeVariant; textKey: Key }> = {
      high: { variant: "emerald", textKey: "randomizer.confidenceHigh" },
      medium: { variant: "score", textKey: "randomizer.confidenceMedium" },
      low: { variant: "amber", textKey: "randomizer.confidenceLow" },
      insufficient: { variant: "neutral", textKey: "randomizer.confInsufficient" },
    };
    const c = map[confidence];
    return <Badge variant={c.variant}>{t(c.textKey)}</Badge>;
  };

  return (
    <div style={style} className={cn("liquid-surface p-5 rounded-tile space-y-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-edge">
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("categorySens.title") || "Sensibilidade por Categoria e Playlists"}
          </h2>
          <p className="text-xs text-text-faint mt-0.5">
            {t("categorySens.subtitle") || "Recomendações e benchmarking empírico por grupo motor"}
          </p>
        </div>

        <Segmented
          options={[
            { value: "category", label: t("randomizer.scopeCategory") || "Categorias" },
            { value: "playlist", label: t("randomizer.scopePlaylist") || "Playlists" },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as "category" | "playlist")}
          size="sm"
        />
      </div>

      {activeTab === "category" ? (
        categoryGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-faint">
            {t("categorySens.empty") || "Nenhum dado por categoria registrado."}
          </div>
        ) : (
          <div className="overflow-x-auto scroll-y liquid-well rounded-control p-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                  <th className="py-2.5 px-3">{t("modal.category") || "Categoria"}</th>
                  <th className="py-2.5 px-3">Cenários</th>
                  <th className="py-2.5 px-3">Runs</th>
                  <th className="py-2.5 px-3">Sens Recomendada</th>
                  <th className="py-2.5 px-3">Confiança</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {categoryGroups.map((g) => (
                  <tr key={g.key} className="hover:bg-surface-hover/40 transition">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-text-main block">{g.category}</span>
                      <span className="text-[11px] text-text-faint block">{g.subcategory}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-text-secondary tabular-nums">
                      {g.scenariosCount}
                    </td>
                    <td className="py-3 px-3 font-mono text-text-secondary tabular-nums">
                      {g.totalRuns}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-score tabular">
                          {g.displaySens.value.toFixed(1)} cm
                        </span>
                        <Badge variant="neutral" className="uppercase font-mono text-[9px]">
                          {g.displaySens.source === "predicted" ? "PRED" : "VIS"}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {getConfidenceBadge(g.confidence)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewInChart?.({ mode: "category", id: g.key })}
                          icon={<ChartLineUp size={13} />}
                        >
                          Gráfico
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void onApplySens?.(g.displaySens.value, g.taskNames)}
                          icon={<Check size={13} />}
                        >
                          {t("randomizer.applySens")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        playlistStatsList.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-faint">
            {t("playlistSens.empty") || "Nenhuma playlist encontrada."}
          </div>
        ) : (
          <div className="overflow-x-auto scroll-y liquid-well rounded-control p-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                  <th className="py-2.5 px-3">Playlist</th>
                  <th className="py-2.5 px-3">Cenários</th>
                  <th className="py-2.5 px-3">Runs</th>
                  <th className="py-2.5 px-3">Sens Recomendada</th>
                  <th className="py-2.5 px-3">Confiança</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {playlistStatsList.map((pl) => (
                  <tr key={pl.playlistId} className="hover:bg-surface-hover/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Folder size={15} className="text-score shrink-0" />
                        <span className="font-semibold text-text-main truncate">
                          {pl.playlistName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-text-secondary tabular-nums">
                      {pl.scenariosCount}
                    </td>
                    <td className="py-3 px-3 font-mono text-text-secondary tabular-nums">
                      {pl.totalRuns}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-emerald tabular text-sm">
                        {pl.displaySens?.value.toFixed(1)} cm
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {getConfidenceBadge(pl.overallConfidence)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewInChart?.({ mode: "playlist", id: pl.playlistId })}
                          icon={<ChartLineUp size={13} />}
                        >
                          Gráfico
                        </Button>
                        {pl.displaySens && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void onApplySens?.(pl.displaySens!.value)}
                            icon={<Check size={13} />}
                          >
                            {t("randomizer.applySens")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
