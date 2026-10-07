import { useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { useI18n } from "@/lib/i18n";
import {
  calculateParabolicTrendline,
  type RunDataPoint,
} from "@/lib/sens-analytics";
import type { Playlist } from "@/lib/types";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export type ChartScopeMode = "current" | "all" | "playlist" | "category";

export interface ChartScopeFilter {
  mode: ChartScopeMode;
  playlistId?: string;
  categoryKey?: string;
}

export interface CategoryOption {
  key: string;
  category: string;
  subcategory: string;
  scenariosCount: number;
}

interface SensRandomizerChartProps {
  relevantSessions: RunDataPoint[];
  scopeFilter?: ChartScopeFilter;
  onChangeScope?: (filter: ChartScopeFilter) => void;
  // Retrocompatibilidade
  scopeAllTasks?: boolean;
  onToggleScope?: (val: boolean) => void;
  playlists?: Playlist[];
  categories?: CategoryOption[];
  scopeTitle?: string;
  theme: string;
}

export function SensRandomizerChart({
  relevantSessions,
  scopeFilter,
  onChangeScope,
  scopeAllTasks = false,
  onToggleScope,
  playlists = [],
  categories = [],
  scopeTitle,
  theme,
}: SensRandomizerChartProps) {
  const { t } = useI18n();
  const isLight = theme === "light";

  const currentFilter: ChartScopeFilter = useMemo(() => {
    if (scopeFilter) return scopeFilter;
    return { mode: scopeAllTasks ? "all" : "current" };
  }, [scopeFilter, scopeAllTasks]);

  const isNormalized = currentFilter.mode !== "current";

  const handleModeChange = (mode: ChartScopeMode) => {
    const nextFilter: ChartScopeFilter = { mode };
    if (mode === "playlist" && playlists.length > 0) {
      nextFilter.playlistId = currentFilter.playlistId || playlists[0].id;
    }
    if (mode === "category" && categories.length > 0) {
      nextFilter.categoryKey = currentFilter.categoryKey || categories[0].key;
    }
    if (onChangeScope) {
      onChangeScope(nextFilter);
    } else if (onToggleScope) {
      onToggleScope(mode === "all");
    }
  };

  const chartData = useMemo(() => {
    if (relevantSessions.length === 0) {
      return { datasets: [] };
    }

    const scatterPoints = relevantSessions.map((s) => ({
      x: s.sens,
      y: s.score,
      scenario: s.scenario,
      date: s.date,
      rawScore: s.rawScore ?? s.score,
      normScore: s.normScore ?? 100,
    }));

    const trendPoints = calculateParabolicTrendline(
      relevantSessions.map((s) => ({ x: s.sens, y: s.score }))
    );

    return {
      datasets: [
        {
          type: "scatter" as const,
          label: isNormalized ? t("randomizer.normPb") : t("randomizer.rawScore"),
          data: scatterPoints,
          backgroundColor: isLight ? "rgba(2, 132, 199, 0.75)" : "rgba(56, 189, 248, 0.8)",
          borderColor: isLight ? "#0284c7" : "#38bdf8",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        ...(trendPoints.length > 0
          ? [
              {
                type: "line" as const,
                label: t("randomizer.chartTrend"),
                data: trendPoints,
                borderColor: "#f59e0b",
                backgroundColor: "transparent",
                borderWidth: 2.5,
                borderDash: [4, 4],
                pointRadius: 0,
                fill: false,
                tension: 0.3,
              },
            ]
          : []),
      ],
    };
  }, [relevantSessions, isNormalized, isLight, t]);

  const chartOptions = useMemo(() => {
    const gridColor = isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.04)";
    const textColor = isLight ? "#475569" : "#94a3b8";

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: textColor,
            font: { size: 11, weight: "bold" as const },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: isLight ? "rgba(255, 255, 255, 0.96)" : "rgba(18, 19, 26, 0.96)",
          titleColor: isLight ? "#0f172a" : "#f8fafc",
          bodyColor: isLight ? "#334155" : "#cbd5e1",
          borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => {
              const raw = ctx.raw;
              if (raw.scenario) {
                if (isNormalized) {
                  return `${raw.scenario}: ${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")} (${raw.rawScore.toFixed(0)} pts) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
                }
                return `${raw.scenario}: ${raw.rawScore.toFixed(1)} pts (${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")}) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
              }
              return `${t("randomizer.chartTrendLabel")}: ${raw.y.toFixed(1)} ${isNormalized ? t("randomizer.chartTooltipOfPb") : "pts"} (${raw.x.toFixed(1)} cm)`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear" as const,
          title: {
            display: true,
            text: t("randomizer.chartSensAxis"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        y: {
          title: {
            display: true,
            text: isNormalized ? t("randomizer.normPb") : t("randomizer.rawScore"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    };
  }, [isLight, isNormalized, t]);

  return (
    <div className="panel p-6 rounded-2xl space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-edge pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.chartTitle")}
            </h3>
            {scopeTitle && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {scopeTitle}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {isNormalized ? t("randomizer.normExplanation") : t("randomizer.chartSubtitle")}
          </p>
        </div>

        {/* Scope Selector Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-stretch lg:self-auto">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl border border-edge overflow-x-auto">
            <button
              type="button"
              onClick={() => handleModeChange("current")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                currentFilter.mode === "current"
                  ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopeCurrent")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("playlist")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                currentFilter.mode === "playlist"
                  ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopePlaylist")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("category")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                currentFilter.mode === "category"
                  ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopeCategory")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("all")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                currentFilter.mode === "all"
                  ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopeAll")}
            </button>
          </div>

          {/* Contextual Dropdown for Playlist */}
          {currentFilter.mode === "playlist" && (
            <select
              aria-label={t("playlistSens.colPlaylist")}
              value={currentFilter.playlistId || (playlists[0]?.id ?? "")}
              onChange={(e) =>
                onChangeScope?.({
                  mode: "playlist",
                  playlistId: e.target.value,
                })
              }
              className="py-1 px-2.5 rounded-lg text-xs font-medium bg-surface border border-edge text-text-main focus:outline-none focus:border-blue-500"
            >
              {playlists.length === 0 ? (
                <option value="">{t("randomizer.noPlaylistsAvailable")}</option>
              ) : (
                playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.items?.length || 0})
                  </option>
                ))
              )}
            </select>
          )}

          {/* Contextual Dropdown for Category */}
          {currentFilter.mode === "category" && (
            <select
              aria-label={t("categorySens.colCategory")}
              value={currentFilter.categoryKey || (categories[0]?.key ?? "")}
              onChange={(e) =>
                onChangeScope?.({
                  mode: "category",
                  categoryKey: e.target.value,
                })
              }
              className="py-1 px-2.5 rounded-lg text-xs font-medium bg-surface border border-edge text-text-main focus:outline-none focus:border-blue-500"
            >
              {categories.length === 0 ? (
                <option value="">{t("randomizer.noCategoriesAvailable")}</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.category} - {cat.subcategory} ({cat.scenariosCount})
                  </option>
                ))
              )}
            </select>
          )}
        </div>
      </div>

      <div className="h-80 w-full relative">
        {relevantSessions.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-surface-subtle border border-edge flex items-center justify-center text-text-faint mb-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-text-main">
              {t("randomizer.chartEmpty")}
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Scatter data={chartData as any} options={chartOptions as any} />
        )}
      </div>
    </div>
  );
}
