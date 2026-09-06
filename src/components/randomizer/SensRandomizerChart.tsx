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

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface SensRandomizerChartProps {
  relevantSessions: RunDataPoint[];
  scopeAllTasks: boolean;
  onToggleScope: (val: boolean) => void;
  theme: string;
}

export function SensRandomizerChart({
  relevantSessions,
  scopeAllTasks,
  onToggleScope,
  theme,
}: SensRandomizerChartProps) {
  const { t } = useI18n();
  const isLight = theme === "light";

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
          label: scopeAllTasks ? t("randomizer.normPb") : t("randomizer.rawScore"),
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
  }, [relevantSessions, scopeAllTasks, isLight, t]);

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
                if (scopeAllTasks) {
                  return `${raw.scenario}: ${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")} (${raw.rawScore.toFixed(0)} pts) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
                }
                return `${raw.scenario}: ${raw.rawScore.toFixed(1)} pts (${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")}) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
              }
              return `${t("randomizer.chartTrendLabel")}: ${raw.y.toFixed(1)} ${scopeAllTasks ? t("randomizer.chartTooltipOfPb") : "pts"} (${raw.x.toFixed(1)} cm)`;
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
            text: scopeAllTasks ? t("randomizer.normPb") : t("randomizer.rawScore"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    };
  }, [isLight, scopeAllTasks, t]);

  return (
    <div className="panel p-6 rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-edge pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
            {t("randomizer.chartTitle")}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("randomizer.chartSubtitle")}
          </p>
        </div>

        {/* Scope Toggle Button */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle rounded-xl border border-edge self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => onToggleScope(false)}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              !scopeAllTasks
                ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            {t("randomizer.scopeCurrent")}
          </button>
          <button
            type="button"
            onClick={() => onToggleScope(true)}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              scopeAllTasks
                ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            {t("randomizer.scopeAll")}
          </button>
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
          <Scatter data={chartData as any} options={chartOptions as any} />
        )}
      </div>
    </div>
  );
}
