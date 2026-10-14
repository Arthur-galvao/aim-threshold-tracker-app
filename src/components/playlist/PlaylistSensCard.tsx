import { useMemo } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  computePlaylistSensStats,
  formatSensitivity,
  type PlaylistSensStats,
} from "@/lib/sens-analytics";

interface PlaylistSensCardProps {
  playlists: Playlist[];
  tasks: Task[];
  mouseDpi?: number;
  onApplySens?: (sensCm: number, targetScenarios?: string[]) => Promise<void>;
  onViewInChart?: (playlistId: string) => void;
}

export function PlaylistSensCard({
  playlists,
  tasks,
  mouseDpi,
  onApplySens,
  onViewInChart,
}: PlaylistSensCardProps) {
  const { t } = useI18n();
  const dpi = mouseDpi || 800;

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const playlistStatsList = useMemo<PlaylistSensStats[]>(() => {
    return playlists.map((pl) => computePlaylistSensStats(pl, tasks, "equilibrado", dpi));
  }, [playlists, tasks, dpi]);

  const renderConfidenceBadge = (
    confidence: "high" | "medium" | "low" | "insufficient"
  ) => {
    switch (confidence) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-soft text-emerald border border-emerald-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
            {t("randomizer.confidenceHigh")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-score-soft text-score border border-score/25">
            <span className="w-1.5 h-1.5 rounded-full bg-score" />
            {t("randomizer.confidenceMedium")}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-soft text-amber border border-amber-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            {t("randomizer.confidenceLow")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-text-faint border border-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-text-faint" />
            {t("randomizer.confInsufficient")}
          </span>
        );
    }
  };

  return (
    <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
      <div className="border-b border-edge pb-4">
        <h3 className="text-sm font-semibold text-text-main font-sans">
          {t("playlistSens.title")}
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          {t("playlistSens.subtitle")}
        </p>
      </div>

      {playlistStatsList.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-faint">
          {t("playlistSens.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                <th className="py-2.5 px-3 whitespace-nowrap">{t("playlistSens.colPlaylist")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("playlistSens.colRecommended")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("playlistSens.colComposition")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("playlistSens.colStats")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("playlistSens.colConfidence")}</th>
                {(onViewInChart || onApplySens) && (
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    {t("playlistSens.colActions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {playlistStatsList.map((stats, index) => {
                const isPredicted = stats.displaySens.source === "predicted";

                return (
                  <tr
                    key={stats.playlistId}
                    style={{ "--i": index } as React.CSSProperties}
                    className="hover:bg-surface-hover/50 transition-colors enter"
                  >
                    {/* Playlist Name & Count */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-text-main">
                        {stats.playlistName}
                      </div>
                      <div className="text-xs text-text-secondary tabular-nums">
                        {t("playlist.itemsCount", { n: stats.scenariosCount })}
                      </div>
                    </td>

                    {/* Recommended Sensitivity */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-text-main tabular-nums">
                          {formatSensitivity(stats.displaySens.value, dpi)}
                        </span>
                        {isPredicted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-soft text-emerald border border-emerald-edge">
                            {t("playlistSens.sourcePredicted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                            {t("playlistSens.sourceViscose")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category Slices Composition */}
                    <td className="py-3 px-3 max-w-xs">
                      {stats.categorySlices.length === 0 ? (
                        <span className="text-text-faint text-xs">-</span>
                      ) : (
                        <div className="text-xs text-text-secondary leading-relaxed">
                          {stats.categorySlices.map((slice, idx) => (
                            <span
                              key={`${slice.category}__${slice.subcategory}`}
                              title={`${slice.category} - ${slice.subcategory}: ${slice.scenariosCount} cenarios, ${slice.totalRuns} runs`}
                            >
                              {idx > 0 && <span className="mx-1.5 text-text-faint opacity-50">•</span>}
                              <span className="text-text-main font-medium">
                                {slice.subcategory}
                              </span>{" "}
                              <span className="font-mono tabular-nums">
                                {formatSensitivity(slice.displaySens.value, dpi)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Stats: Scenarios / Runs */}
                    <td className="py-3 px-3 text-text-secondary whitespace-nowrap tabular-nums">
                      {t("playlistSens.scenariosRuns", {
                        scenarios: stats.scenariosCount,
                        runs: stats.totalRuns,
                      })}
                    </td>

                    {/* Overall Confidence */}
                    <td className="py-3 px-3">
                      {renderConfidenceBadge(stats.overallConfidence)}
                    </td>

                    {/* Actions: View in Chart & Apply Sens */}
                    {(onViewInChart || onApplySens) && (
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onViewInChart && (
                            <button
                              type="button"
                              onClick={() => onViewInChart(stats.playlistId)}
                              className="press px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-all whitespace-nowrap cursor-pointer"
                            >
                              {t("playlistSens.viewInChart")}
                            </button>
                          )}
                          {onApplySens && (
                            <button
                              type="button"
                              onClick={() => {
                                const pl = playlists.find((p) => p.id === stats.playlistId);
                                const scenarioNames = pl
                                  ? (pl.items.map((i) => taskMap.get(i.taskId)?.name).filter(Boolean) as string[])
                                  : [];
                                void onApplySens(stats.displaySens.value, scenarioNames);
                              }}
                              className="press px-3 py-1.5 text-xs font-semibold rounded-xl bg-score hover:brightness-105 text-primary-foreground transition-all whitespace-nowrap cursor-pointer shadow-xs"
                            >
                              {t("playlistSens.applySens")}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
