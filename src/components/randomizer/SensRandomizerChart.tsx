import { useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { useI18n } from "@/lib/i18n";
import {
  type RunDataPoint,
  type SensPrediction,
  binByLattice,
  fitQuadraticLog,
  predictOptimalSensitivity,
} from "@/lib/sens-analytics";
import { latticeIndex } from "@/lib/sens-lattice";
import type { Playlist } from "@/lib/types";
import { SensCoverageBar } from "./SensCoverageBar";

ChartJS.register(
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
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

interface SensRandomizerChartProps {
  relevantSessions: RunDataPoint[];
  scopeFilter?: ChartScopeFilter;
  onChangeScope?: (filter: ChartScopeFilter) => void;
  playlists?: Playlist[];
  categories?: CategoryOption[];
  scopeTitle?: string;
  theme: string;
  activeMinCm?: number;
  activeMaxCm?: number;
  prediction?: SensPrediction | null;
}

export function SensRandomizerChart({
  relevantSessions,
  scopeFilter,
  onChangeScope,
  playlists = [],
  categories = [],
  scopeTitle,
  theme,
  activeMinCm,
  activeMaxCm,
  prediction,
}: SensRandomizerChartProps) {
  const { t } = useI18n();
  const isLight = theme === "light";

  const currentFilter: ChartScopeFilter = useMemo(() => {
    if (scopeFilter) return scopeFilter;
    return { mode: "current" };
  }, [scopeFilter]);

  const isNormalized = currentFilter.mode !== "current";

  const handleModeChange = (mode: ChartScopeMode) => {
    const nextFilter: ChartScopeFilter = { mode };
    if (mode === "playlist" && playlists.length > 0) {
      nextFilter.playlistId = currentFilter.playlistId || playlists[0].id;
    }
    if (mode === "category" && categories.length > 0) {
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
    if (validRuns.length === 0) {
      return { datasets: [] };
    }

    const scatterPoints = validRuns.map((s) => ({
      x: s.sens,
      y: s.score,
      scenario: s.scenario,
      date: s.date,
      rawScore: s.rawScore ?? s.score,
      normScore: s.normScore ?? 100,
    }));

    const yVals = validRuns.map((s) => s.score);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);

    // 1. Curva do kernel suavizada por ponto de grade
    let kernelCurvePoints: Array<{ x: number; y: number }> = [];
    if (validRuns.length >= 3) {
      const points = validRuns.map((r) => ({ k: latticeIndex(r.sens), rel: r.score }));
      const bins = binByLattice(points);
      if (bins.length > 0) {
        kernelCurvePoints = bins
          .map((b) => ({ x: Number(b.cm.toFixed(1)), y: b.smooth }))
          .sort((a, b) => a.x - b.x);
      }
    }

    // 2. Curva quadratica amostrada em u (log-space)
    const quadCurvePoints: Array<{ x: number; y: number }> = [];
    if (validRuns.length >= 12) {
      const pts = validRuns.map((r) => ({ cm: r.sens, y: r.score }));
      const quad = fitQuadraticLog(pts);
      if (quad) {
        const minCm = Math.min(...validRuns.map((r) => r.sens));
        const maxCm = Math.max(...validRuns.map((r) => r.sens));
        if (maxCm > minCm) {
          const lnMin = Math.log(minCm);
          const lnMax = Math.log(maxCm);
          const steps = 30;
          for (let i = 0; i <= steps; i++) {
            const lnVal = lnMin + (i / steps) * (lnMax - lnMin);
            const cm = Math.exp(lnVal);
            const u = Math.log(cm / quad.refCm);
            const y = quad.a * u * u + quad.b * u + quad.c;
            quadCurvePoints.push({ x: Number(cm.toFixed(2)), y });
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      {
        type: "scatter" as const,
        label: isNormalized ? t("randomizer.normPb") : t("randomizer.rawScore"),
        data: scatterPoints,
        backgroundColor: "var(--score-soft)",
        borderColor: "var(--score)",
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ];

    if (kernelCurvePoints.length > 0) {
      datasets.push({
        type: "line" as const,
        label: t("randomizer.chartKernel"),
        data: kernelCurvePoints,
        borderColor: "var(--score)",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      });
    }

    if (quadCurvePoints.length > 0) {
      datasets.push({
        type: "line" as const,
        label: t("randomizer.chartTrend"),
        data: quadCurvePoints,
        borderColor: "var(--amber)",
        backgroundColor: "transparent",
        borderWidth: 2.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    // Linhas verticais tracejadas para a faixa ativa
    if (activeMinCm != null && activeMinCm > 0) {
      datasets.push({
        type: "line" as const,
        label: t("randomizer.activeRangeMin"),
        data: [
          { x: activeMinCm, y: yMin * 0.95 },
          { x: activeMinCm, y: yMax * 1.05 },
        ],
        borderColor: isLight ? "rgba(100, 116, 139, 0.45)" : "rgba(148, 163, 184, 0.4)",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    if (activeMaxCm != null && activeMaxCm > 0) {
      datasets.push({
        type: "line" as const,
        label: t("randomizer.activeRangeMax"),
        data: [
          { x: activeMaxCm, y: yMin * 0.95 },
          { x: activeMaxCm, y: yMax * 1.05 },
        ],
        borderColor: isLight ? "rgba(100, 116, 139, 0.45)" : "rgba(148, 163, 184, 0.4)",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    // Vertice com barra horizontal do IC
    if (
      effectivePrediction &&
      effectivePrediction.vertexSens != null &&
      effectivePrediction.scoreEstimate != null
    ) {
      const yEst = effectivePrediction.scoreEstimate;
      if (
        effectivePrediction.ci &&
        effectivePrediction.ci.low != null &&
        effectivePrediction.ci.high != null
      ) {
        datasets.push({
          type: "line" as const,
          label: t("randomizer.confidenceInterval"),
          data: [
            { x: effectivePrediction.ci.low, y: yEst },
            { x: effectivePrediction.ci.high, y: yEst },
          ],
          borderColor: "var(--accent)",
          backgroundColor: "transparent",
          borderWidth: 3,
          pointRadius: 3,
          fill: false,
        });
      }

      datasets.push({
        type: "scatter" as const,
        label: t("randomizer.predictorApex"),
        data: [{ x: effectivePrediction.vertexSens, y: yEst }],
        backgroundColor: "var(--red)",
        borderColor: "var(--red)",
        pointRadius: 7,
        pointHoverRadius: 9,
        pointStyle: "rectRot",
      });
    }

    return { datasets };
  }, [
    validRuns,
    isNormalized,
    isLight,
    t,
    activeMinCm,
    activeMaxCm,
    effectivePrediction,
  ]);

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
              return `${ctx.dataset.label || t("randomizer.chartTrendLabel")}: ${raw.y.toFixed(1)} ${isNormalized ? t("randomizer.chartTooltipOfPb") : "pts"} (${raw.x.toFixed(1)} cm)`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "logarithmic" as const,
          title: {
            display: true,
            text: t("randomizer.chartSensAxis"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callback: (value: any) => `${Number(value).toFixed(0)}`,
          },
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
    <div className="glass-panel p-4 sm:p-6 space-y-4">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4 border-b border-edge pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[13px] font-mono font-semibold tracking-wider text-text-main uppercase">
              {t("randomizer.chartTitle")}
            </h3>
            {scopeTitle && currentFilter.mode === "current" && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-surface-subtle border border-edge text-text-secondary truncate max-w-[200px] tabular-nums">
                {scopeTitle}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {isNormalized ? t("randomizer.normExplanation") : t("randomizer.chartSubtitle")}
          </p>
        </div>

        {/* Scope Selector Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-surface-subtle/80 rounded-xl border border-edge w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleModeChange("current")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-center press cursor-pointer ${
                currentFilter.mode === "current"
                  ? "bg-surface text-text-main shadow-xs border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopeCurrent")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("playlist")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-center press cursor-pointer ${
                currentFilter.mode === "playlist"
                  ? "bg-surface text-text-main shadow-xs border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopePlaylist")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("category")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-center press cursor-pointer ${
                currentFilter.mode === "category"
                  ? "bg-surface text-text-main shadow-xs border border-edge-strong"
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              {t("randomizer.scopeCategory")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("all")}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all text-center press cursor-pointer ${
                currentFilter.mode === "all"
                  ? "bg-surface text-text-main shadow-xs border border-edge-strong"
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
              className="py-1.5 px-3 rounded-xl text-xs font-medium glass-input text-text-main focus:outline-none focus:border-score/40 w-full sm:w-auto"
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
              className="py-1.5 px-3 rounded-xl text-xs font-medium glass-input text-text-main focus:outline-none focus:border-score/40 w-full sm:w-auto"
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

      <div className="h-64 sm:h-72 lg:h-80 w-full relative">
        {validRuns.length === 0 ? (
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

      <SensCoverageBar
        relevantSessions={relevantSessions}
        minCm={activeMinCm}
        maxCm={activeMaxCm}
      />
    </div>
  );
}
