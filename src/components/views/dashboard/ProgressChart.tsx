import { useMemo, useState } from "react";
import { ChartLineUp } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { buildChartSeries, filterChartSeries, type ChartSeries } from "@/lib/day-summary";
import { useSkill } from "@/hooks/useSkill";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartToolbar, type ChartPeriod } from "./ChartToolbar";
import { ChartCanvas } from "./ChartCanvas";
import { cn } from "@/lib/utils";

export interface ProgressChartProps {
  activeTask: Task | null;
  className?: string;
}

const DAY_MS = 86_400_000;
const FALLBACK_RUNS = 20;

/** Recorta a série ao período; se nada cair na janela, mostra as últimas runs. */
function filterByPeriod(series: ChartSeries, period: ChartPeriod, now: number): ChartSeries {
  if (period === "all" || series.runs.length === 0) return series;
  const days = period === "7D" ? 7 : 30;
  const lastT = series.runs[series.runs.length - 1].t;
  const cutoff = Math.max(now, lastT) - days * DAY_MS;
  const filtered = filterChartSeries(series, (r) => r.t >= cutoff);
  if (filtered.runs.length > 0) return filtered;
  const firstKept = Math.max(0, series.runs.length - FALLBACK_RUNS);
  return filterChartSeries(series, (r) => r.index >= firstKept);
}

export function ProgressChart({ activeTask, className }: ProgressChartProps) {
  const { t } = useI18n();
  const skill = useSkill(activeTask?.id ?? null);
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [showTarget, setShowTarget] = useState(true);
  const [showPB, setShowPB] = useState(true);
  const [showMu, setShowMu] = useState(true);

  const allSeries = useMemo(() => buildChartSeries(activeTask, skill), [activeTask, skill]);
  const series = useMemo(
    () => filterByPeriod(allSeries, period, Date.now()),
    [allSeries, period]
  );

  return (
    <div className={cn("glass p-5 flex flex-col", className)}>
      <ChartToolbar
        period={period}
        onPeriodChange={setPeriod}
        showTarget={showTarget}
        onToggleTarget={() => setShowTarget((v) => !v)}
        showPB={showPB}
        onTogglePB={() => setShowPB((v) => !v)}
        showMu={showMu}
        onToggleMu={() => setShowMu((v) => !v)}
      />

      {series.runs.length === 0 ? (
        <EmptyState
          icon={<ChartLineUp size={24} weight="regular" />}
          title={t("chart.empty")}
          description={t("dashboard.emptyDesc")}
          className="min-h-[220px]"
        />
      ) : (
        <ChartCanvas
          series={series}
          showTarget={showTarget}
          showPB={showPB}
          showMu={showMu}
        />
      )}
    </div>
  );
}
