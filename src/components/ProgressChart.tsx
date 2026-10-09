import { useMemo, useState } from "react";
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
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";


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

const COLORS = {
  dark: {
    line: "#38bdf8",
    lineFill: "rgba(56, 189, 248, 0.06)",
    threshold: "rgba(255, 255, 255, 0.4)",
    thresholdFill: "transparent",
    avg: "#94a3b8",
    grid: "rgba(255, 255, 255, 0.03)",
    tick: "#64748b",
    legend: "#94a3b8",
    tooltipBg: "#0f1118",
    tooltipTitle: "#f8fafc",
    tooltipBody: "#94a3b8",
    tooltipBorder: "rgba(255, 255, 255, 0.08)",
  },
  light: {
    line: "#0284c7",
    lineFill: "rgba(2, 132, 199, 0.05)",
    threshold: "#d97706",
    thresholdFill: "transparent",
    avg: "#71717a",
    grid: "rgba(0, 0, 0, 0.04)",
    tick: "#71717a",
    legend: "#52525b",
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

export function ProgressChart({ activeTask }: ProgressChartProps) {
  const [avgType, setAvgType] = useState<"moving" | "overall">("moving");
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();
  const c = COLORS[resolvedTheme];

  const chartData = useMemo(() => {
    if (!activeTask?.sessions?.length) return null;

    const sorted = [...activeTask.sessions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const dateCounts: Record<string, number> = {};
    for (const s of sorted) {
      dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
    }

    const dateSeen: Record<string, number> = {};
    const labels = sorted.map((s) => {
      const [, m, d] = s.date.split("-");
      const base = `${d}/${m}`;
      if (dateCounts[s.date] > 1) {
        dateSeen[s.date] = (dateSeen[s.date] || 0) + 1;
        return `${base} #${dateSeen[s.date]}`;
      }
      return base;
    });

    const pbData = sorted.map((s) => s.pb);
    const threshData = sorted.map((s) => s.threshold);

    let avgData: number[] = [];
    if (avgType === "moving") {
      for (let i = 0; i < threshData.length; i++) {
        const start = Math.max(0, i - 2);
        const subset = threshData.slice(start, i + 1);
        avgData.push(Math.round(subset.reduce((a, v) => a + v, 0) / subset.length));
      }
    } else {
      const overall = Math.round(
        threshData.reduce((a, v) => a + v, 0) / threshData.length
      );
      avgData = threshData.map(() => overall);
    }

    return {
      labels,
      datasets: [
        {
          label: t("chart.score"),
          data: pbData,
          borderColor: c.line,
          backgroundColor: c.lineFill,
          borderWidth: 2,
          tension: 0.25, // Clean spline curve
          pointBackgroundColor: c.line,
          pointBorderColor: resolvedTheme === "dark" ? "#0f1118" : "#ffffff",
          pointBorderWidth: 1.5,
          pointRadius: 0, // No permanent dots; sleek instrument look
          pointHoverRadius: 4.5,
          pointHoverBackgroundColor: c.line,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          fill: true,
        },
        {
          label: t("chart.threshold"),
          data: threshData,
          borderColor: resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.4)" : "#64748b",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: [5, 5],
          tension: 0.2,
          pointBackgroundColor: resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.5)" : "#64748b",
          pointBorderColor: resolvedTheme === "dark" ? "#0f1118" : "#ffffff",
          pointBorderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
        },
        {
          label: avgType === "moving" ? t("chart.avgMoving") : t("chart.avgOverall"),
          data: avgData,
          borderColor: c.avg,
          borderWidth: 1,
          borderDash: [3, 3],
          tension: 0.2,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [activeTask, avgType, c, resolvedTheme, t]);

  if (!chartData) {
    return (
      <div className="p-8 h-72 rounded-xl flex flex-col items-center justify-center text-text-faint text-xs bg-[#12141e]/60">
        <span className="p-3 rounded-md bg-surface-subtle border border-edge mb-3 opacity-60">
          <ChartLineUp size={28} weight="duotone" />
        </span>
        <span className="font-mono uppercase tracking-widest text-[10px]">
          {t("chart.empty")}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#12141e]/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-[13px] font-mono font-semibold uppercase tracking-wider text-text-main">
            Data Chart
          </h2>
        </div>

        <div className="flex items-center gap-1.5 p-0.5 rounded-md bg-[#12141e] border border-edge">
          <button
            type="button"
            onClick={() => setAvgType("moving")}
            className={`px-3 py-1 text-[10px] font-mono font-medium rounded transition-colors cursor-pointer ${
              avgType === "moving"
                ? "bg-surface-subtle text-text-main shadow-xs"
                : "text-text-faint hover:text-text-secondary"
            }`}
          >
            {t("chart.moving")}
          </button>
          <button
            type="button"
            onClick={() => setAvgType("overall")}
            className={`px-3 py-1 text-[10px] font-mono font-medium rounded transition-colors cursor-pointer ${
              avgType === "overall"
                ? "bg-surface-subtle text-text-main shadow-xs"
                : "text-text-faint hover:text-text-secondary"
            }`}
          >
            {t("chart.overall")}
          </button>
        </div>
      </div>

      <div className="relative h-72 sm:h-80 w-full">
        <Line
          data={chartData}
          plugins={[crosshairPlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 0, // Instant response
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
                position: "top",
                align: "end",
                labels: {
                  color: c.legend,
                  font: {
                    family: '"Geist Mono Variable", monospace',
                    size: 10,
                    weight: 600,
                  },
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
                  pointStyle: "rect",
                  padding: 14,
                },
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
                  size: 10,
                },
                bodyFont: {
                  family: '"Geist Mono Variable", monospace',
                  size: 10,
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
                  maxTicksLimit: 7,
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
