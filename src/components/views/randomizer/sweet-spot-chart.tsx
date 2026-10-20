import { useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { useI18n } from "@/lib/i18n";
import {
  type RunDataPoint,
  type SensPrediction,
  predictOptimalSensitivity,
} from "@/lib/sens-analytics";
import type { Playlist } from "@/lib/types";
import { Segmented } from "@/components/ui/Segmented";
import { CoverageBar } from "./coverage-bar";
import { buildChartDatasets, buildChartOptions } from "./chart-utils";
import { cn } from "@/lib/utils";

ChartJS.register(
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Legend
);

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

export interface SweetSpotChartProps {
  relevantSessions: RunDataPoint[];
  scopeFilter?: ChartScopeFilter;
  onChangeScope?: (filter: ChartScopeFilter) => void;
  playlists?: Playlist[];
  categories?: CategoryOption[];
  scopeTitle?: string;
  activeMinCm?: number;
  activeMaxCm?: number;
  prediction?: SensPrediction | null;
  className?: string;
  style?: React.CSSProperties;
}

export function SweetSpotChart({
  relevantSessions,
  scopeFilter,
  onChangeScope,
  playlists = [],
  categories = [],
  scopeTitle,
  activeMinCm,
  activeMaxCm,
  prediction,
  className,
  style,
}: SweetSpotChartProps) {
  const { t } = useI18n();

  const currentFilter: ChartScopeFilter = useMemo(() => {
    return scopeFilter ?? { mode: "current" };
  }, [scopeFilter]);

  const isNormalized = currentFilter.mode !== "current";

  const handleModeChange = (mode: string) => {
    const validMode = mode as ChartScopeMode;
    const nextFilter: ChartScopeFilter = { mode: validMode };
    if (validMode === "playlist" && playlists.length > 0) {
      nextFilter.playlistId = currentFilter.playlistId || playlists[0].id;
    }
    if (validMode === "category" && categories.length > 0) {
      nextFilter.categoryKey = currentFilter.categoryKey || categories[0].key;
    }
    onChangeScope?.(nextFilter);
  };

  const validRuns = useMemo(() => {
    return relevantSessions.filter((s) => s.sens > 0 && Number.isFinite(s.score));
  }, [relevantSessions]);

  const effectivePrediction = useMemo(() => {
    if (prediction !== undefined) return prediction;
    if (validRuns.length === 0) return null;
    return predictOptimalSensitivity(validRuns);
  }, [prediction, validRuns]);

  const chartData = useMemo(() => {
    return buildChartDatasets({
      validRuns,
      isNormalized,
      activeMinCm,
      activeMaxCm,
      effectivePrediction,
      labels: {
        normPb: t("randomizer.normPb"),
        rawScore: t("randomizer.rawScore"),
        chartKernel: t("randomizer.chartKernel"),
        chartTrend: t("randomizer.chartTrend"),
        activeRangeMin: t("randomizer.activeRangeMin"),
        activeRangeMax: t("randomizer.activeRangeMax"),
        confidenceInterval: t("randomizer.confidenceInterval"),
        predictorApex: t("randomizer.predictorApex"),
      },
    });
  }, [validRuns, isNormalized, activeMinCm, activeMaxCm, effectivePrediction, t]);

  const chartOptions = useMemo(() => {
    return buildChartOptions(isNormalized, {
      normPb: t("randomizer.normPb"),
      rawScore: t("randomizer.rawScore"),
      chartSensAxis: t("randomizer.chartSensAxis"),
      chartTooltipOfPb: t("randomizer.chartTooltipOfPb"),
      chartTooltipAt: t("randomizer.chartTooltipAt"),
      chartTrendLabel: t("randomizer.chartTrendLabel"),
    });
  }, [isNormalized, t]);

  const scopeOptions = [
    { value: "current", label: t("randomizer.scopeCurrent") },
    { value: "all", label: t("randomizer.scopeAll") },
    { value: "playlist", label: t("randomizer.scopePlaylist") || "Playlist" },
    { value: "category", label: t("randomizer.scopeCategory") || "Categoria" },
  ];

  return (
    <div style={style} className={cn("glass p-5 rounded-tile space-y-4", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("randomizer.chartTitle")}
          </h2>
          {scopeTitle && (
            <p className="text-xs text-text-faint mt-0.5 font-medium">
              {scopeTitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            options={scopeOptions}
            value={currentFilter.mode}
            onChange={handleModeChange}
            size="sm"
          />

          {currentFilter.mode === "playlist" && playlists.length > 0 && (
            <select
              value={currentFilter.playlistId || playlists[0].id}
              onChange={(e) =>
                onChangeScope?.({ ...currentFilter, playlistId: e.target.value })
              }
              className="field text-xs py-1 px-2.5 h-7 rounded-control"
            >
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id} className="bg-surface text-text-main">
                  {pl.name}
                </option>
              ))}
            </select>
          )}

          {currentFilter.mode === "category" && categories.length > 0 && (
            <select
              value={currentFilter.categoryKey || categories[0].key}
              onChange={(e) =>
                onChangeScope?.({ ...currentFilter, categoryKey: e.target.value })
              }
              className="field text-xs py-1 px-2.5 h-7 rounded-control"
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key} className="bg-surface text-text-main">
                  {c.category} - {c.subcategory} ({c.scenariosCount})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="h-[280px] w-full pt-2">
        {validRuns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-faint text-xs">
            <span>{t("randomizer.chartEmpty")}</span>
          </div>
        ) : (
          <Scatter data={chartData} options={chartOptions} />
        )}
      </div>

      <CoverageBar
        relevantSessions={relevantSessions}
        minCm={activeMinCm}
        maxCm={activeMaxCm}
      />
    </div>
  );
}
