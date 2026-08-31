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

interface ProgressChartProps {
  activeTask: Task | null;
}

const COLORS = {
  dark: {
    line: "#fafafa",
    lineFill: "rgba(250, 250, 250, 0.04)",
    threshold: "#fbbf24",
    thresholdFill: "rgba(251, 191, 36, 0.05)",
    avg: "#52525b",
    grid: "rgba(255, 255, 255, 0.05)",
    tick: "#71717a",
    legend: "#a1a1aa",
    tooltipBg: "#18181b",
    tooltipTitle: "#fafafa",
    tooltipBody: "#a1a1aa",
    tooltipBorder: "#27272a",
  },
  light: {
    line: "#09090b",
    lineFill: "rgba(9, 9, 11, 0.03)",
    threshold: "#d97706",
    thresholdFill: "rgba(217, 119, 6, 0.04)",
    avg: "#a1a1aa",
    grid: "rgba(0, 0, 0, 0.05)",
    tick: "#71717a",
    legend: "#71717a",
    tooltipBg: "#ffffff",
    tooltipTitle: "#09090b",
    tooltipBody: "#71717a",
    tooltipBorder: "#e4e4e7",
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
          borderWidth: 1.5,
          tension: 0.1,
          pointBackgroundColor: c.line,
          pointRadius: 2.5,
        },
        {
          label: t("chart.threshold"),
          data: threshData,
          borderColor: c.threshold,
          backgroundColor: c.thresholdFill,
          borderWidth: 1.5,
          tension: 0.1,
          pointBackgroundColor: c.threshold,
          pointRadius: 2.5,
        },
        {
          label:
            avgType === "moving" ? t("chart.avgMoving") : t("chart.avgOverall"),
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
  }, [activeTask, avgType, c, t]);

  if (!chartData) {
    return (
      <div className="panel h-72 flex items-center justify-center text-text-faint text-xs transition-colors">
        {t("chart.empty")}
      </div>
    );
  }

  return (
    <section className="panel p-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge pb-3 mb-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
            {t("chart.title")}
          </h2>
          <p className="text-[11px] text-text-faint">
            {t("chart.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={avgType}
            onChange={(e) => setAvgType(e.target.value as "moving" | "overall")}
            className="minimal-input text-[11px] py-1 px-2 font-mono"
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
            plugins: {
              legend: {
                position: "top",
                align: "end",
                labels: {
                  color: c.legend,
                  font: { family: "'JetBrains Mono', monospace", size: 10 },
                  boxWidth: 12,
                  usePointStyle: true,
                },
              },
              tooltip: {
                backgroundColor: c.tooltipBg,
                titleColor: c.tooltipTitle,
                bodyColor: c.tooltipBody,
                borderColor: c.tooltipBorder,
                borderWidth: 1,
                padding: 10,
                boxPadding: 4,
                titleFont: { family: "Inter", weight: "bold", size: 11 },
                bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
              },
            },
            scales: {
              x: {
                grid: { color: c.grid },
                ticks: { color: c.tick, font: { family: "'JetBrains Mono', monospace", size: 9 } },
              },
              y: {
                grid: { color: c.grid },
                ticks: { color: c.tick, font: { family: "'JetBrains Mono', monospace", size: 9 } },
              },
            },
          }}
        />
      </div>
    </section>
  );
}
