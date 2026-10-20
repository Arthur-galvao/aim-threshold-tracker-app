import { useMemo, useState } from "react";
import { ChartLineUp } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { summarizeDays, type DaySummary } from "@/lib/day-summary";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartToolbar, type ChartPeriod } from "./ChartToolbar";
import { ChartCanvas } from "./ChartCanvas";
import { cn } from "@/lib/utils";

export interface ProgressChartProps {
  activeTask: Task | null;
  className?: string;
}

function filterByPeriod(summaries: DaySummary[], period: ChartPeriod): DaySummary[] {
  if (period === "all" || summaries.length === 0) return summaries;
  const days = period === "7D" ? 7 : 30;
  const lastDate = new Date(summaries[summaries.length - 1].date);
  const now = new Date();
  const refDate = now > lastDate ? now : lastDate;
  const cutoff = new Date(refDate);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(
    cutoff.getDate()
  ).padStart(2, "0")}`;

  const filtered = summaries.filter((d) => d.date >= cutoffStr);
  return filtered.length > 0 ? filtered : summaries.slice(-days);
}

export function ProgressChart({ activeTask, className }: ProgressChartProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [showThreshold, setShowThreshold] = useState(true);
  const [showPB, setShowPB] = useState(true);
  const [showMA3, setShowMA3] = useState(true);

  const allSummaries = useMemo(() => summarizeDays(activeTask), [activeTask]);
  const summaries = useMemo(() => filterByPeriod(allSummaries, period), [allSummaries, period]);

  const data = useMemo(() => {
    return summaries.map((d, i, arr) => {
      const start = Math.max(0, i - 2);
      const slice = arr.slice(start, i + 1);
      const ma3 = Math.round(slice.reduce((acc, curr) => acc + curr.best, 0) / slice.length);
      return {
        ...d,
        ma3,
      };
    });
  }, [summaries]);

  return (
    <div className={cn("glass p-5 flex flex-col", className)}>
      <ChartToolbar
        period={period}
        onPeriodChange={setPeriod}
        showThreshold={showThreshold}
        onToggleThreshold={() => setShowThreshold((v) => !v)}
        showPB={showPB}
        onTogglePB={() => setShowPB((v) => !v)}
        showMA3={showMA3}
        onToggleMA3={() => setShowMA3((v) => !v)}
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<ChartLineUp size={24} weight="regular" />}
          title={t("chart.empty")}
          description={t("dashboard.emptyDesc")}
          className="min-h-[220px]"
        />
      ) : (
        <ChartCanvas
          data={data}
          showThreshold={showThreshold}
          showPB={showPB}
          showMA3={showMA3}
        />
      )}
    </div>
  );
}
