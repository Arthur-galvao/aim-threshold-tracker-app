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
  '"Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "Inter", sans-serif';

interface ProgressChartProps {
  activeTask: Task | null;
}

const COLORS = {
  dark: {
    line: "#38bdf8",
    lineFill: "rgba(56, 189, 248, 0.04)",
    threshold: "#f59e0b",
    thresholdFill: "transparent",
    avg: "#64748b",
    grid: "rgba(255, 255, 255, 0.03)",
    tick: "#64748b",
    legend: "#94a3b8",
    tooltipBg: "#12131a",
    tooltipTitle: "#f8fafc",
    tooltipBody: "#94a3b8",
    tooltipBorder: "rgba(255, 255, 255, 0.08)",
  },
  light: {
    line: "#0284c7",
    lineFill: "rgba(2, 132, 199, 0.03)",
    threshold: "#d97706",
    thresholdFill: "transparent",
    avg: "#a1a1aa",
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

    const labels = sorted.map((s) => {
      const [, m, d] = s.date.split("-");
      return `${d}/${m}`;
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
      <div className="panel p-6 rounded-2xl h-72 flex flex-col items-center justify-center text-text-faint text-xs transition-all">
        <svg
          className="w-8 h-8 mb-2 opacity-40 text-text-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>{t("chart.empty")}</span>
      </div>
    );
  }

  return (
    <section className="panel p-5 rounded-2xl transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("chart.title")}
            </h2>
            <p className="text-[11px] text-text-faint">
              {t("chart.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={avgType}
            onChange={(e) => setAvgType(e.target.value as "moving" | "overall")}
            className="minimal-input text-xs py-1 px-2.5 font-medium cursor-pointer rounded-full"
          >
            <option value="moving">{t("chart.moving")}</option>
            <option value="overall">{t("chart.overall")}</option>
          </select>
        </div>
      </div>

      <div className="relative h-72 sm:h-80 w-full">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
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
                  font: { family: '"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif', size: 11, weight: 600 },
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
                cornerRadius: 12,
                padding: 12,
                boxPadding: 6,
                titleFont: { family: '"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif', weight: 700, size: 12 },
                bodyFont: { family: '"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif', size: 11 },
              },
            },
            scales: {
              x: {
                grid: { color: c.grid },
                ticks: {
                  color: c.tick,
                  font: { family: '"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif', size: 11 },
                  maxTicksLimit: 7,
                  autoSkip: true,
                  maxRotation: 0,
                },
              },
              y: {
                grid: { color: c.grid },
                ticks: {
                  color: c.tick,
                  font: { family: '"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif', size: 11 },
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
