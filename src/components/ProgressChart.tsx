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
import { useI18n } from "@/lib/i18n";
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
          borderWidth: 2.5,
          tension: 0.25,
          pointBackgroundColor: c.line,
          pointBorderColor: resolvedTheme === "dark" ? "#12131a" : "#ffffff",
          pointBorderWidth: 1.5,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: c.line,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          fill: true,
        },
        {
          label: t("chart.threshold"),
          data: threshData,
          borderColor: c.threshold,
          backgroundColor: c.thresholdFill,
          borderWidth: 2,
          tension: 0.25,
          pointBackgroundColor: c.threshold,
          pointBorderColor: resolvedTheme === "dark" ? "#12131a" : "#ffffff",
          pointBorderWidth: 1.5,
          pointRadius: 3.5,
          pointHoverRadius: 5.5,
          fill: false,
        },
        {
          label:
            avgType === "moving" ? t("chart.avgMoving") : t("chart.avgOverall"),
          data: avgData,
          borderColor: c.avg,
          borderWidth: 1.5,
          borderDash: [5, 5],
          tension: 0.25,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [activeTask, avgType, c, resolvedTheme, t]);

  if (!chartData) {
    return (
      <div className="panel p-8 rounded-2xl h-72 flex flex-col items-center justify-center text-text-muted text-xs border border-edge transition-all">
        <span className="p-3 rounded-2xl bg-surface-subtle border border-edge text-text-muted mb-3 opacity-60">
          <ChartLineUp size={28} weight="duotone" />
        </span>
        <span className="font-medium">{t("chart.empty")}</span>
      </div>
    );
  }

  return (
    <section className="panel p-5 rounded-2xl border border-edge transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <TrendUp size={15} weight="bold" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
              {t("chart.title")}
            </h2>
            <p className="text-[11px] text-text-muted">
              {t("chart.subtitle")}
            </p>
          </div>
        </div>

        <div>
          <Segmented
            value={avgType}
            onChange={(val) => setAvgType(val as "moving" | "overall")}
            options={[
              { value: "moving", label: t("chart.moving") },
              { value: "overall", label: t("chart.overall") },
            ]}
          />
        </div>
      </div>

      <div className="relative h-72 sm:h-80 w-full">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 250,
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
                    family: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    size: 11,
                    weight: 600,
                  },
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 14,
                },
              },
              tooltip: {
                backgroundColor: c.tooltipBg,
                titleColor: c.tooltipTitle,
                bodyColor: c.tooltipBody,
                borderColor: c.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 10,
                padding: 12,
                boxPadding: 6,
                titleFont: {
                  family: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  weight: 600,
                  size: 12,
                },
                bodyFont: {
                  family: '"Geist Mono", monospace',
                  size: 11,
                },
              },
            },
            scales: {
              x: {
                grid: { color: c.grid },
                ticks: {
                  color: c.tick,
                  font: {
                    family: '"Geist Mono", monospace',
                    size: 11,
                  },
                  maxTicksLimit: 7,
                  autoSkip: true,
                  maxRotation: 0,
                },
              },
              y: {
                grid: { color: c.grid },
                ticks: {
                  color: c.tick,
                  font: {
                    family: '"Geist Mono", monospace',
                    size: 11,
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
