import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
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
  LineController,
  ScatterController,
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
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setThemeTick((v) => v + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

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
  }, [validRuns, isNormalized, activeMinCm, activeMaxCm, effectivePrediction, t, themeTick]);

  const chartOptions = useMemo(() => {
    return buildChartOptions(isNormalized, {
      normPb: t("randomizer.normPb"),
      rawScore: t("randomizer.rawScore"),
      chartSensAxis: t("randomizer.chartSensAxis"),
      chartTooltipOfPb: t("randomizer.chartTooltipOfPb"),
      chartTooltipAt: t("randomizer.chartTooltipAt"),
      chartTrendLabel: t("randomizer.chartTrendLabel"),
    });
  }, [isNormalized, t, themeTick]);

  const scopeOptions = [
    { value: "current", label: t("randomizer.scopeCurrent") },
    { value: "all", label: t("randomizer.scopeAll") },
    { value: "playlist", label: t("randomizer.scopePlaylist") || "Playlist" },
    { value: "category", label: t("randomizer.scopeCategory") || "Categoria" },
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      style={style}
      onMouseMove={handleMouseMove}
      className={cn(
        "liquid-surface liquid-interactive p-5 rounded-tile space-y-4",
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold text-text-main tracking-tight">
            {t("randomizer.chartTitle")}
          </h2>
          {scopeTitle && (
            <p className="text-[11px] text-text-faint mt-0.5 font-mono">
              {scopeTitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            id="sweet-spot-scope"
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

      <div className="liquid-well p-3 rounded-control h-[290px] w-full">
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
