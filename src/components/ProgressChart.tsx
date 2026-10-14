import { useMemo, useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { ChartLineUp } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { summarizeDays } from "@/lib/day-summary";
import { useTheme, getStoredTheme, APP_THEMES, type AppTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { Tooltip as UiTooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family =
  '"Geist Variable", "Segoe UI", Roboto, sans-serif';

interface ProgressChartProps {
  activeTask: Task | null;
}

type ViewMode = "day" | "run";
type Period = "7D" | "30D" | "90D" | "all";

const COLORS = {
  dark: {
    line: "#38bdf8",
    lineFill: "rgba(56, 189, 248, 0.08)",
    bandFill: "rgba(56, 189, 248, 0.12)",
    threshold: "rgba(255, 255, 255, 0.45)",
    avg: "#94a3b8",
    grid: "rgba(255, 255, 255, 0.04)",
    tick: "#64748b",
    tooltipBg: "#0f1118",
    tooltipTitle: "#f8fafc",
    tooltipBody: "#94a3b8",
    tooltipBorder: "rgba(255, 255, 255, 0.1)",
  },
  light: {
    line: "#0284c7",
    lineFill: "rgba(2, 132, 199, 0.06)",
    bandFill: "rgba(2, 132, 199, 0.10)",
    threshold: "#64748b",
    avg: "#71717a",
    grid: "rgba(0, 0, 0, 0.04)",
    tick: "#71717a",
    tooltipBg: "#ffffff",
    tooltipTitle: "#090d16",
    tooltipBody: "#52525b",
    tooltipBorder: "rgba(0, 0, 0, 0.08)",
  },
};

const crosshairPlugin = {
  id: "crosshair",
  afterDraw: (chart: any) => {
    if (chart.tooltip?._active && chart.tooltip._active.length) {
      const activePoint = chart.tooltip._active[0];
      const ctx = chart.ctx;
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }
  },
};

function filterItemsByPeriod<T extends { date: string }>(
  items: T[],
  period: Period
): T[] {
  if (period === "all" || items.length === 0) return items;
  const days = period === "7D" ? 7 : period === "30D" ? 30 : 90;

  const lastDate = new Date(items[items.length - 1].date);
  const now = new Date();
  const refDate = now > lastDate ? now : lastDate;
  const cutoff = new Date(refDate);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const filtered = items.filter((item) => item.date >= cutoffStr);
  return filtered.length > 0 ? filtered : items.slice(-days);
}

export function ProgressChart({ activeTask }: ProgressChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [hiddenSeries, setHiddenSeries] = useState<Set<number>>(new Set());
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();

  const [appTheme, setAppTheme] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    const checkTheme = () => {
      setAppTheme(getStoredTheme());
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const themeConfig = APP_THEMES.find((item) => item.id === appTheme) ?? APP_THEMES[0];
  const accentColor = themeConfig.color;

  const baseC = COLORS[resolvedTheme === "light" ? "light" : "dark"];
  const c = useMemo(() => {
    if (resolvedTheme === "light") return baseC;
    return {
      ...baseC,
      line: accentColor,
      lineFill: `${accentColor}14`,
      bandFill: `${accentColor}1f`,
    };
  }, [baseC, accentColor, resolvedTheme]);

  const allSummaries = useMemo(
    () => summarizeDays(activeTask),
    [activeTask]
  );

  const activePeriod: Period =
    selectedPeriod ?? (allSummaries.length > 30 ? "30D" : "all");

  const toggleSeries = (index: number) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const dayViewData = useMemo(() => {
    if (!allSummaries.length) return null;
    const filtered = filterItemsByPeriod(allSummaries, activePeriod);
    if (!filtered.length) return null;

    const labels = filtered.map((d) => {
      const [, m, day] = d.date.split("-");
      return `${day}/${m}`;
    });

    const minData = filtered.map((d) => d.min);
    const bestData = filtered.map((d) => d.best);
    const threshData = filtered.map((d) => d.threshold);

    const movingAvgData: number[] = [];
    for (let i = 0; i < bestData.length; i++) {
      const start = Math.max(0, i - 2);
      const subset = bestData.slice(start, i + 1);
      movingAvgData.push(
        Math.round(subset.reduce((acc, v) => acc + v, 0) / subset.length)
      );
    }

    const pointRadii = filtered.map((d) =>
      d.isPbDay ? 5 : d.hit === false ? 3.5 : 2.5
    );
    const pointBackgrounds = filtered.map((d) =>
      d.isPbDay ? "#f59e0b" : d.hit === false ? "#ef4444" : c.line
    );
    const pointBorders = filtered.map((d) =>
      d.isPbDay
        ? "#d97706"
        : d.hit === false
          ? "#b91c1c"
          : resolvedTheme === "dark"
            ? "#0f1118"
            : "#ffffff"
    );

    const datasets: any[] = [
      // 0: Min line (lower boundary of dispersion band, invisible line)
      {
        label: `${t("chart.bandDispersion")} (min)`,
        data: minData,
        hidden: hiddenSeries.has(0),
        borderColor: "transparent",
        backgroundColor: "transparent",
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      },
      // 1: Best line (fills to dataset 0)
      {
        label: t("chart.score"),
        data: bestData,
        hidden: hiddenSeries.has(0),
        borderColor: c.line,
        backgroundColor: c.bandFill,
        borderWidth: 2,
        tension: 0.2,
        pointBackgroundColor: pointBackgrounds,
        pointBorderColor: pointBorders,
        pointBorderWidth: 1.5,
        pointRadius: pointRadii,
        pointHoverRadius: 5,
        fill: "-1",
      },
      // 2: Threshold (stepped)
      {
        label: t("chart.threshold"),
        data: threshData,
        hidden: hiddenSeries.has(1),
        borderColor: c.threshold,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [5, 5],
        stepped: "before" as const,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
      },
    ];

    if (showMovingAvg) {
      datasets.push({
        label: t("chart.avgMoving"),
        data: movingAvgData,
        hidden: hiddenSeries.has(2),
        borderColor: c.avg,
        borderWidth: 1,
        borderDash: [3, 3],
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
      });
    }

    return {
      labels,
      datasets,
      summaries: filtered,
    };
  }, [allSummaries, activePeriod, hiddenSeries, showMovingAvg, c, resolvedTheme, t]);

  const runViewData = useMemo(() => {
    if (!activeTask?.sessions?.length) return null;

    const sorted = [...activeTask.sessions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const filtered = filterItemsByPeriod(sorted, activePeriod);
    if (!filtered.length) return null;

    const dateCounts: Record<string, number> = {};
    for (const s of filtered) {
      dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
    }

    const dateSeen: Record<string, number> = {};
    const labels = filtered.map((s) => {
      const [, m, d] = s.date.split("-");
      const base = `${d}/${m}`;
      if (dateCounts[s.date] > 1) {
        dateSeen[s.date] = (dateSeen[s.date] || 0) + 1;
        return `${base} #${dateSeen[s.date]}`;
      }
      return base;
    });

    const pbData = filtered.map((s) => s.pb);
    const threshData = filtered.map((s) => s.threshold);

    const movingAvgData: number[] = [];
    for (let i = 0; i < pbData.length; i++) {
      const start = Math.max(0, i - 2);
      const subset = pbData.slice(start, i + 1);
      movingAvgData.push(
        Math.round(subset.reduce((a, v) => a + v, 0) / subset.length)
      );
    }

    const datasets: any[] = [
      {
        label: t("chart.score"),
        data: pbData,
        hidden: hiddenSeries.has(0),
        borderColor: c.line,
        backgroundColor: c.lineFill,
        borderWidth: 2,
        tension: 0.25,
        pointBackgroundColor: c.line,
        pointBorderColor: resolvedTheme === "dark" ? "#0f1118" : "#ffffff",
        pointBorderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4.5,
        fill: true,
      },
      {
        label: t("chart.threshold"),
        data: threshData,
        hidden: hiddenSeries.has(1),
        borderColor: c.threshold,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [5, 5],
        stepped: "before" as const,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
      },
    ];

    if (showMovingAvg) {
      datasets.push({
        label: t("chart.avgMoving"),
        data: movingAvgData,
        hidden: hiddenSeries.has(2),
        borderColor: c.avg,
        borderWidth: 1,
        borderDash: [3, 3],
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
      });
    }

    return {
      labels,
      datasets,
      sessions: filtered,
    };
  }, [activeTask, activePeriod, hiddenSeries, showMovingAvg, c, resolvedTheme, t]);

  const activeChart = viewMode === "day" ? dayViewData : runViewData;

  if (!activeChart) {
    return (
      <div className="p-8 h-72 rounded-2xl flex flex-col items-center justify-center text-text-faint text-xs liquid-glass-panel shadow-xs">
        <span className="p-3 rounded-xl liquid-glass-control mb-3 opacity-60">
          <ChartLineUp size={28} weight="duotone" />
        </span>
        <span className="font-mono uppercase tracking-widest text-[10px]">
          {t("chart.empty")}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 rounded-2xl liquid-glass-panel shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-score-soft text-score border border-score/25 flex items-center justify-center shadow-xs">
            <ChartLineUp size={14} weight="bold" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main font-mono">
              {t("chart.title")}
            </h2>
            <p className="text-[10px] text-text-faint font-mono">
              {t("chart.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Toggle Segmentado: Dia | Run */}
          <div className="flex items-center p-0.5 rounded-lg liquid-glass-control">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono font-medium rounded-md transition-all cursor-pointer press",
                viewMode === "day"
                  ? "bg-surface-elevated text-score shadow-xs border border-edge font-bold"
                  : "text-text-faint hover:text-text-secondary"
              )}
            >
              {t("chart.modeDay")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("run")}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono font-medium rounded-md transition-all cursor-pointer press",
                viewMode === "run"
                  ? "bg-surface-elevated text-score shadow-xs border border-edge font-bold"
                  : "text-text-faint hover:text-text-secondary"
              )}
            >
              {t("chart.modeRun")}
            </button>
          </div>

          {/* Filtro de Período: 7D | 30D | 90D | Tudo */}
          <div className="flex items-center p-0.5 rounded-lg liquid-glass-control">
            {(["7D", "30D", "90D", "all"] as Period[]).map((p) => {
              const label =
                p === "7D"
                  ? t("chart.period7D")
                  : p === "30D"
                    ? t("chart.period30D")
                    : p === "90D"
                      ? t("chart.period90D")
                      : t("chart.periodAll");
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono font-medium rounded-md transition-all cursor-pointer press",
                    activePeriod === p
                      ? "bg-surface-elevated text-text-main shadow-xs border border-edge font-bold"
                      : "text-text-faint hover:text-text-secondary"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Legenda Interativa */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] font-mono select-none">
            <UiTooltip content={t("chart.toggleSeries")}>
              <button
                type="button"
                onClick={() => toggleSeries(0)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer press",
                  hiddenSeries.has(0)
                    ? "opacity-35 line-through hover:opacity-60"
                    : "text-text-main hover:bg-surface-subtle border border-transparent hover:border-edge"
                )}
              >
                <span className="w-3 h-1 rounded-sm bg-score inline-block shrink-0" />
                <span>{t("chart.score")}</span>
              </button>
            </UiTooltip>

            <UiTooltip content={t("chart.toggleSeries")}>
              <button
                type="button"
                onClick={() => toggleSeries(1)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer press",
                  hiddenSeries.has(1)
                    ? "opacity-35 line-through hover:opacity-60"
                    : "text-text-secondary hover:bg-surface-subtle border border-transparent hover:border-edge"
                )}
              >
                <span className="w-3 border-t border-dashed border-text-faint inline-block shrink-0" />
                <span>{t("chart.threshold")}</span>
              </button>
            </UiTooltip>

            <UiTooltip content={t("chart.toggleSeries")}>
              <button
                type="button"
                onClick={() => setShowMovingAvg((prev) => !prev)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer press",
                  !showMovingAvg || hiddenSeries.has(2)
                    ? "opacity-35 line-through hover:opacity-60"
                    : "text-text-faint hover:bg-surface-subtle border border-transparent hover:border-edge"
                )}
              >
                <span className="w-3 border-t border-dotted border-text-faint/60 inline-block shrink-0" />
                <span>{t("chart.avgMoving")}</span>
              </button>
            </UiTooltip>
          </div>
        </div>
      </div>

      <div className="relative h-60 sm:h-72 lg:h-80 w-full">
        <Line
          data={activeChart}
          plugins={[crosshairPlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 0,
            },
            layout: {
              padding: {
                right: 14,
                left: 4,
                top: 4,
                bottom: 4,
              },
            },
            interaction: {
              mode: "index",
              intersect: false,
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: c.tooltipBg,
                titleColor: c.tooltipTitle,
                bodyColor: c.tooltipBody,
                borderColor: c.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 6,
                padding: 10,
                boxPadding: 4,
                titleFont: {
                  family: '"Geist Mono Variable", monospace',
                  weight: 600,
                  size: 11,
                },
                bodyFont: {
                  family: '"Geist Mono Variable", monospace',
                  size: 10,
                },
                callbacks: {
                  title: (items) => {
                    if (!items.length) return "";
                    const idx = items[0].dataIndex;
                    if (viewMode === "day" && dayViewData) {
                      const day = dayViewData.summaries[idx];
                      return `${t("hist.colDate")}: ${day.date}`;
                    }
                    if (viewMode === "run" && runViewData) {
                      const sess = runViewData.sessions[idx];
                      return `${t("hist.colDate")}: ${sess.date}`;
                    }
                    return items[0].label;
                  },
                  label: (item) => {
                    // Oculta a linha de min do tooltip pois ela é apenas o piso da faixa
                    if (viewMode === "day" && item.datasetIndex === 0) {
                      return "";
                    }
                    return `${item.dataset.label}: ${item.formattedValue}`;
                  },
                  afterBody: (items) => {
                    if (!items.length) return [];
                    const idx = items[0].dataIndex;
                    if (viewMode === "day" && dayViewData) {
                      const day = dayViewData.summaries[idx];
                      const status =
                        day.hit === true
                          ? t("chart.tooltipHit")
                          : day.hit === false
                            ? t("chart.tooltipMiss")
                            : "—";
                      const sensStr = day.sens.length
                        ? `${day.sens.join(", ")} cm`
                        : "—";
                      return [
                        `${t("chart.tooltipMin")}: ${day.min}`,
                        `${t("chart.tooltipAvg")}: ${day.avg}`,
                        `${t("chart.tooltipRuns")}: ${day.runs}`,
                        `${t("chart.tooltipTarget")}: ${day.targetBefore ?? day.threshold}`,
                        `${t("chart.tooltipStatus")}: ${status}`,
                        `${t("chart.tooltipSens")}: ${sensStr}`,
                      ];
                    }
                    if (viewMode === "run" && runViewData) {
                      const sess = runViewData.sessions[idx];
                      return [`${t("chart.tooltipSens")}: ${sess.sens} cm`];
                    }
                    return [];
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: c.grid, drawTicks: false },
                ticks: {
                  color: c.tick,
                  font: {
                    family: '"Geist Mono Variable", monospace',
                    size: 10,
                  },
                  maxTicksLimit: 8,
                  autoSkip: true,
                  maxRotation: 0,
                },
              },
              y: {
                grid: { color: c.grid, drawTicks: false },
                ticks: {
                  color: c.tick,
                  font: {
                    family: '"Geist Mono Variable", monospace',
                    size: 10,
                  },
                  maxTicksLimit: 6,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
