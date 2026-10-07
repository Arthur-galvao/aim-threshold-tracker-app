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
import { ChartLineUp, TrendUp } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { Segmented } from "@/components/ui/Segmented";

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
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

interface ProgressChartProps {
  activeTask: Task | null;
}

const COLORS = {
  dark: {
    line: "#38bdf8",
    lineFill: "rgba(56, 189, 248, 0.05)",
    threshold: "#f59e0b",
    thresholdFill: "transparent",
    avg: "#94a3b8",
    grid: "rgba(255, 255, 255, 0.04)",
    tick: "#64748b",
    legend: "#94a3b8",
    tooltipBg: "#12131a",
    tooltipTitle: "#f8fafc",
    tooltipBody: "#94a3b8",
    tooltipBorder: "rgba(255, 255, 255, 0.08)",
  },
  light: {
    line: "#0284c7",
    lineFill: "rgba(2, 132, 199, 0.04)",
    threshold: "#d97706",
    thresholdFill: "transparent",
    avg: "#71717a",
    grid: "rgba(0, 0, 0, 0.04)",
    tick: "#71717a",
    legend: "#52525b",
    tooltipBg: "#ffffff",
    tooltipTitle: "#09090b",
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
      ctx.strokeStyle = "var(--text-faint)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  },
};

export function ProgressChart({ activeTask }: ProgressChartProps) {
  const [avgType, setAvgType] = useState<"moving" | "overall">("moving");
  const { resolvedTheme } = useTheme();
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
          label: "SCORE",
          data: pbData,
          borderColor: c.line,
          backgroundColor: c.lineFill,
          borderWidth: 2,
          tension: 0, // Sharp lines for instrument feel
          pointBackgroundColor: c.line,
          pointBorderColor: resolvedTheme === "dark" ? "#12131a" : "#ffffff",
          pointBorderWidth: 1,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: c.line,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          fill: true,
        },
        {
          label: "THRESHOLD",
          data: threshData,
          borderColor: "var(--emerald)",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0,
          pointBackgroundColor: "var(--emerald)",
          pointBorderColor: resolvedTheme === "dark" ? "#12131a" : "#ffffff",
          pointBorderWidth: 1,
          pointRadius: 2,
          pointHoverRadius: 4,
          fill: false,
        },
        {
          label: avgType === "moving" ? "AVG (MOVING)" : "AVG (OVERALL)",
          data: avgData,
          borderColor: c.avg,
          borderWidth: 1,
          borderDash: [3, 3],
          tension: 0,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [activeTask, avgType, c, resolvedTheme]);

  if (!chartData) {
    return (
      <div className="panel p-8 rounded-[10px] h-72 flex flex-col items-center justify-center text-text-faint text-xs border border-edge">
        <span className="p-3 rounded-md bg-surface-subtle border border-edge mb-3 opacity-60">
          <ChartLineUp size={28} weight="duotone" />
        </span>
        <span className="font-mono uppercase tracking-widest text-[10px]">NO DATA</span>
      </div>
    );
  }

  return (
    <section className="panel p-5 rounded-[10px] border border-edge">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <TrendUp size={15} weight="bold" />
          </div>
          <div>
            <h2 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-main">
              SCORE-OVER-TIME
            </h2>
          </div>
        </div>

        <div>
          <Segmented
            value={avgType}
            onChange={(val) => setAvgType(val as "moving" | "overall")}
            options={[
              { value: "moving", label: "MOVING AVG" },
              { value: "overall", label: "OVERALL AVG" },
            ]}
          />
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
              duration: 0, // Instant rendering for instrument feel
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
                    family: '"Geist Mono", monospace',
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
                cornerRadius: 4, // Sharper corners
                padding: 10,
                boxPadding: 4,
                titleFont: {
                  family: '"Geist Mono", monospace',
                  weight: 600,
                  size: 10,
                },
                bodyFont: {
                  family: '"Geist Mono", monospace',
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
                    family: '"Geist Mono", monospace',
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
                    family: '"Geist Mono", monospace',
                    size: 10,
                  },
                  maxTicksLimit: 6,
                },
              },
            },
          }}
        />
      </div>
    </section>
  );
}
