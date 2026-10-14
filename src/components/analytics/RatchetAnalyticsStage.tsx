import { useMemo, useState, type ReactNode } from "react";
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
import { ChartLineUp, Sparkle, TrendUp } from "@phosphor-icons/react";
import { ToggleGroup, Toggle } from "@base-ui/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useTheme } from "@/lib/theme";
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

export type TimeRangeFilter = "7d" | "30d" | "all";
export type AnalyticsPeriod = TimeRangeFilter;

export interface RatchetAnalyticsStageProps {
  className?: string;
  children?: ReactNode;
}

export function RatchetAnalyticsStageEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-8 min-h-[380px] rounded-2xl flex flex-col items-center justify-center text-center liquid-glass-panel shadow-xs",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-score/15 border border-score/30 flex items-center justify-center text-score mb-4 shadow-xs">
        <ChartLineUp size={28} weight="duotone" />
      </div>
      <h3 className="font-mono font-bold text-sm text-text-main uppercase tracking-wider">
        Nenhum Dado Registrado
      </h3>
      <p className="font-mono text-xs text-text-faint mt-1.5 max-w-sm">
        Registre sua primeira sessão no formulário rápido ou ative o KovaaK&apos;s Watcher para iniciar a Catraca Ascendente.
      </p>
    </div>
  );
}

export function RatchetAnalyticsStageToolbar({
  period,
  onPeriodChange,
  showPBLine,
  onTogglePBLine,
  showMA3,
  onToggleMA3,
}: {
  period: TimeRangeFilter;
  onPeriodChange: (p: TimeRangeFilter) => void;
  showPBLine: boolean;
  onTogglePBLine: () => void;
  showMA3: boolean;
  onToggleMA3: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-soft text-emerald border border-emerald-edge flex items-center justify-center shadow-xs">
          <TrendUp size={16} weight="bold" />
        </div>
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-text-main">
            Evolução Cronológica & Degraus da Catraca
          </h2>
          <p className="text-[11px] text-text-faint font-mono">
            Histórico real com proteção de platô • Escala vertical com 15% de margem óptica
          </p>
        </div>
      </div>

      {/* Window Selector & Legend Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {/* PB Toggle */}
        <button
          type="button"
          onClick={onTogglePBLine}
          className={cn(
            "px-2.5 py-1 text-[11px] font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5 select-none liquid-glass-control press",
            showPBLine
              ? "text-score font-semibold border-score/30"
              : "opacity-40 line-through text-text-faint"
          )}
        >
          <Sparkle size={12} weight="bold" />
          <span>PB Acumulado</span>
        </button>

        {/* MA3 Toggle */}
        <button
          type="button"
          onClick={onToggleMA3}
          className={cn(
            "px-2.5 py-1 text-[11px] font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5 select-none liquid-glass-control press",
            showMA3
              ? "text-accent font-semibold border-accent/30"
              : "opacity-40 line-through text-text-faint"
          )}
        >
          <TrendUp size={12} weight="bold" />
          <span>Média Móvel 3s</span>
        </button>

        {/* Base UI ToggleGroup for Period (7D / 30D / Tudo) */}
        <ToggleGroup
          value={[period]}
          onValueChange={(vals) => {
            if (vals && vals.length > 0) {
              onPeriodChange(vals[0] as TimeRangeFilter);
            }
          }}
          className="flex items-center p-0.5 rounded-xl bg-surface-subtle/80 border border-edge"
        >
          <Toggle
            value="7d"
            className={cn(
              "px-3 py-1 text-[11px] font-mono font-semibold rounded-lg transition-all cursor-pointer select-none press",
              period === "7d"
                ? "bg-score/25 text-score border border-score/40 font-bold"
                : "text-text-faint hover:text-text-secondary"
            )}
          >
            7D
          </Toggle>
          <Toggle
            value="30d"
            className={cn(
              "px-3 py-1 text-[11px] font-mono font-semibold rounded-lg transition-all cursor-pointer select-none press",
              period === "30d"
                ? "bg-score/25 text-score border border-score/40 font-bold"
                : "text-text-faint hover:text-text-secondary"
            )}
          >
            30D
          </Toggle>
          <Toggle
            value="all"
            className={cn(
              "px-3 py-1 text-[11px] font-mono font-semibold rounded-lg transition-all cursor-pointer select-none press",
              period === "all"
                ? "bg-score/25 text-score border border-score/40 font-bold"
                : "text-text-faint hover:text-text-secondary"
            )}
          >
            Tudo
          </Toggle>
        </ToggleGroup>
      </div>
    </div>
  );
}

export function RatchetAnalyticsStageCanvas({
  data,
  options,
  className,
}: {
  data: any;
  options: any;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full h-[340px] lg:h-[370px] p-4 rounded-2xl bg-surface-subtle/40 border border-edge shadow-inner", className)}>
      <Line data={data} options={options} />
    </div>
  );
}

export function RatchetAnalyticsStage({ className }: RatchetAnalyticsStageProps) {
  const { state } = useTrackerWorkspace();
  const { activeTask } = state;
  const { resolvedTheme } = useTheme();

  const [period, setPeriod] = useState<TimeRangeFilter>("30d");
  const [showMA3, setShowMA3] = useState(true);
  const [showPBLine, setShowPBLine] = useState(true);

  // Full chronological history (from S1 to latest)
  const fullSessions = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return [];
    return [...activeTask.sessions].sort((a, b) => a.date.localeCompare(b.date));
  }, [activeTask?.sessions]);

  // Compute full cumulative metrics over the ENTIRE history first (Plan 05 principle)
  const enrichedFullSessions = useMemo(() => {
    let runningPB = 0;
    return fullSessions.map((s, idx) => {
      const score = Number(s.pb) || 0;
      const isNewPB = score > runningPB;
      if (isNewPB) {
        runningPB = score;
      }

      // Moving average of last 3 sessions
      const sliceStart = Math.max(0, idx - 2);
      const window = fullSessions.slice(sliceStart, idx + 1);
      const ma3 =
        window.reduce((acc, cur) => acc + (Number(cur.pb) || 0), 0) / window.length;

      // Detect if this session held a plateau (previous threshold preserved despite lower score)
      const prevSession = idx > 0 ? fullSessions[idx - 1] : null;
      const heldPlateau =
        prevSession !== null &&
        s.threshold === prevSession.threshold &&
        score < (Number(prevSession.pb) || 0);

      return {
        ...s,
        sessionIndex: idx + 1,
        cumulativePB: runningPB,
        isNewPB,
        ma3: Number(ma3.toFixed(1)),
        heldPlateau,
        timestamp: new Date(s.date).getTime(),
      };
    });
  }, [fullSessions]);

  // Time-slice filtering (7D / 30D / Tudo) based on actual dates
  const visibleSessions = useMemo(() => {
    if (enrichedFullSessions.length === 0) return [];
    if (period === "all") return enrichedFullSessions;

    const now = Date.now();
    const days = period === "7d" ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const filtered = enrichedFullSessions.filter((s) => s.timestamp >= cutoff);
    // If 7D or 30D has no entries, fallback to showing full or at least the latest session
    return filtered;
  }, [enrichedFullSessions, period]);

  // Chart data configuration
  const chartData = useMemo(() => {
    if (visibleSessions.length === 0) return null;

    const isSingleSession = visibleSessions.length === 1;

    const labels = visibleSessions.map((s) => {
      const parts = s.date.split("-");
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : s.date;
      return `${shortDate} (S${s.sessionIndex})`;
    });

    const thresholdValues = visibleSessions.map((s) => s.threshold);
    const scoreValues = visibleSessions.map((s) => Number(s.pb) || 0);
    const pbLineValues = visibleSessions.map((s) => s.cumulativePB);
    const ma3Values = visibleSessions.map((s) => s.ma3);

    // Points visible on PB ONLY when PB was broken
    const pbPointRadii = visibleSessions.map((s) => (s.isNewPB ? 4.5 : 0));

    const datasets: any[] = [
      // 1. Threshold Line (Stepped Catraca Ascendente in Emerald)
      {
        label: "Catraca (Degrau)",
        data: thresholdValues,
        borderColor: "var(--emerald)",
        backgroundColor: "var(--emerald-soft)",
        fill: true,
        stepped: "before" as const,
        borderWidth: 3,
        tension: 0,
        pointRadius: isSingleSession ? 6 : 0,
        pointBackgroundColor: "var(--emerald)",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        segment: {
          // Highlight plateau segments in Amber
          borderColor: (ctx: any) => {
            const idx = ctx.p1DataIndex;
            if (visibleSessions[idx]?.heldPlateau) {
              return "var(--amber)";
            }
            return "var(--emerald)";
          },
        },
      },
      // 2. Score Run Points
      {
        label: "Score da Sessão",
        data: scoreValues,
        borderColor: "rgba(255, 255, 255, 0.3)",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: "#f8fafc",
        pointBorderColor: "var(--score)",
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        fill: false,
      },
    ];

    // 3. PB Line (Score Cyan/Blue)
    if (showPBLine) {
      datasets.push({
        label: "PB Acumulado",
        data: pbLineValues,
        borderColor: "var(--score)",
        borderWidth: 2.5,
        borderDash: [5, 4],
        tension: 0.25,
        pointRadius: isSingleSession ? [5] : pbPointRadii,
        pointBackgroundColor: "var(--score)",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        fill: false,
      });
    }

    // 4. Moving Average 3s (Accent Lavender)
    if (showMA3) {
      datasets.push({
        label: "Média Móvel 3s",
        data: ma3Values,
        borderColor: "var(--accent)",
        borderWidth: 2,
        borderDash: [6, 5],
        tension: 0.4,
        pointRadius: isSingleSession ? 4 : 0,
        pointBackgroundColor: "var(--accent)",
        pointBorderColor: "#ffffff",
        pointHoverRadius: 4,
        fill: false,
      });
    }

    return { labels, datasets };
  }, [visibleSessions, showMA3, showPBLine]);

  // Chart options with 15% grace vertical margins and zero vertical grid lines
  const chartOptions = useMemo(() => {
    const isDark = resolvedTheme !== "light";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
          titleColor: isDark ? "#f8fafc" : "#090d16",
          bodyColor: isDark ? "#94a3b8" : "#475569",
          borderColor: isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(15, 23, 42, 0.15)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          bodyFont: { family: '"JetBrains Mono", monospace', size: 11 },
          titleFont: { family: '"JetBrains Mono", monospace', size: 12, weight: "bold" as const },
          callbacks: {
            footer: (tooltipItems: any[]) => {
              if (tooltipItems.length === 0) return "";
              const idx = tooltipItems[0].dataIndex;
              const s = visibleSessions[idx];
              if (!s) return "";
              if (s.heldPlateau) {
                return "Platô Protegido (Catraca evitou queda)";
              }
              if (s.isNewPB) {
                return "Novo Recorde Pessoal!";
              }
              return "";
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false, // Zero vertical grid lines as specified in Plan 05
          },
          ticks: {
            color: isDark ? "#64748b" : "#94a3b8",
            font: { family: '"JetBrains Mono", monospace', size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          grace: "15%", // 15% optical breathing room above PB and below Threshold
          grid: {
            color: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
          },
          ticks: {
            color: isDark ? "#64748b" : "#94a3b8",
            font: { family: '"JetBrains Mono", monospace', size: 11 },
            maxTicksLimit: 6,
            padding: 12,
          },
        },
      },
    };
  }, [resolvedTheme, visibleSessions]);

  // Empty state (0 sessions)
  if (!activeTask || fullSessions.length === 0) {
    return <RatchetAnalyticsStageEmptyState className={className} />;
  }

  return (
    <div className={cn("p-6 rounded-2xl liquid-glass-panel shadow-xs flex flex-col justify-between", className)}>
      <RatchetAnalyticsStageToolbar
        period={period}
        onPeriodChange={setPeriod}
        showPBLine={showPBLine}
        onTogglePBLine={() => setShowPBLine((prev) => !prev)}
        showMA3={showMA3}
        onToggleMA3={() => setShowMA3((prev) => !prev)}
      />

      {visibleSessions.length === 0 ? (
        <div className="h-[340px] lg:h-[370px] rounded-2xl liquid-glass-control flex flex-col items-center justify-center p-6 text-center select-none">
          <p className="text-xs font-mono text-text-faint">
            Nenhuma sessão encontrada nos últimos {period === "7d" ? "7 dias" : "30 dias"}.
          </p>
          <button
            type="button"
            onClick={() => setPeriod("all")}
            className="mt-3 px-3 py-1.5 rounded-xl liquid-glass-control text-xs font-mono font-semibold text-score hover:brightness-110 cursor-pointer"
          >
            Ver Histórico Completo (Tudo)
          </button>
        </div>
      ) : (
        <RatchetAnalyticsStageCanvas
          data={chartData}
          options={chartOptions}
        />
      )}
    </div>
  );
}

// Compound component attachments
RatchetAnalyticsStage.Toolbar = RatchetAnalyticsStageToolbar;
RatchetAnalyticsStage.Canvas = RatchetAnalyticsStageCanvas;
RatchetAnalyticsStage.EmptyState = RatchetAnalyticsStageEmptyState;
