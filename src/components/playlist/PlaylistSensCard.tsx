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
  onApplySens?: (sensCm: number) => Promise<void>;
  onViewInChart?: (playlistId: string) => void;
}

export function PlaylistSensCard({
  playlists,
  tasks,
  onApplySens,
  onViewInChart,
}: PlaylistSensCardProps) {
  const { t } = useI18n();

  const playlistStatsList = useMemo<PlaylistSensStats[]>(() => {
    return playlists.map((pl) => computePlaylistSensStats(pl, tasks));
  }, [playlists, tasks]);

  const renderConfidenceBadge = (
    confidence: "high" | "medium" | "low" | "insufficient"
  ) => {
    switch (confidence) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t("randomizer.confidenceHigh")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {t("randomizer.confidenceMedium")}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t("randomizer.confidenceLow")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle text-text-faint border border-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-text-faint" />
            {t("randomizer.confInsufficient")}
          </span>
        );
    }
  };

  return (
    <div className="panel p-6 rounded-2xl border-edge-strong relative overflow-hidden space-y-4">
      <div className="border-b border-edge pb-4">
        <h3 className="text-base font-bold text-text-main">
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                <th className="py-2.5 px-3">{t("playlistSens.colPlaylist")}</th>
                <th className="py-2.5 px-3">{t("playlistSens.colRecommended")}</th>
                <th className="py-2.5 px-3">{t("playlistSens.colComposition")}</th>
                <th className="py-2.5 px-3">{t("playlistSens.colStats")}</th>
                <th className="py-2.5 px-3">{t("playlistSens.colConfidence")}</th>
                {(onViewInChart || onApplySens) && (
                  <th className="py-2.5 px-3 text-right">
                    {t("playlistSens.colActions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {playlistStatsList.map((stats) => {
                const isPredicted = stats.displaySens.source === "predicted";

                return (
                  <tr
                    key={stats.playlistId}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    {/* Playlist Name & Count */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-text-main">
                        {stats.playlistName}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        {t("playlist.itemsCount", { n: stats.scenariosCount })}
                      </div>
                    </td>

                    {/* Recommended Sensitivity */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-text-main">
                          {formatSensitivity(stats.displaySens.value)}
                        </span>
                        {isPredicted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {t("playlistSens.sourcePredicted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {t("playlistSens.sourceViscose")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category Slices Composition */}
                    <td className="py-3 px-3 max-w-xs">
                      {stats.categorySlices.length === 0 ? (
                        <span className="text-text-faint text-[11px]">-</span>
                      ) : (
                        <div className="text-[11px] text-text-secondary leading-relaxed">
                          {stats.categorySlices.map((slice, idx) => (
                            <span
                              key={`${slice.category}__${slice.subcategory}`}
                              title={`${slice.category} - ${slice.subcategory}: ${slice.scenariosCount} cenarios, ${slice.totalRuns} runs`}
                            >
                              {idx > 0 && <span className="mx-1.5 text-text-faint opacity-50">•</span>}
                              <span className="text-text-main font-medium">
                                {slice.subcategory}
                              </span>{" "}
                              <span className="font-mono">
                                {formatSensitivity(slice.displaySens.value)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Stats: Scenarios / Runs */}
                    <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
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
                        <div className="flex items-center justify-end gap-1.5">
                          {onViewInChart && (
                            <button
                              type="button"
                              onClick={() => onViewInChart(stats.playlistId)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-colors whitespace-nowrap"
                            >
                              {t("playlistSens.viewInChart")}
                            </button>
                          )}
                          {onApplySens && (
                            <button
                              type="button"
                              onClick={() => void onApplySens(stats.displaySens.value)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
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
