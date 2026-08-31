import type { Task } from "@/lib/types";
import { computeTaskMetrics } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";

interface MetricsCardsProps {
  activeTask: Task | null;
}

export function MetricsCards({ activeTask }: MetricsCardsProps) {
  const metrics = computeTaskMetrics(activeTask);
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="panel p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {t("metric.pb")}
        </span>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
            {metrics.maxPB ?? "—"}
          </span>
          <span className="text-[11px] text-text-faint font-mono">
            {t("metric.pts")}
          </span>
        </div>
      </div>

      <div className="panel p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {t("metric.threshold")}
        </span>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-amber">
            {metrics.targetThreshold ?? "—"}
          </span>
          <span className="text-[11px] text-text-faint font-mono">
            {t("metric.target")}
          </span>
        </div>
      </div>

      <div className="panel p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {t("metric.consistency")}
        </span>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-emerald">
            {metrics.consistency ?? "—%"}
          </span>
        </div>
      </div>

      <div className="panel p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {t("metric.sens")}
        </span>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-mono font-bold tracking-tight text-text-main">
            {metrics.lastSens ?? "—"}
          </span>
          <span className="text-[11px] text-text-faint font-mono">cm/360</span>
        </div>
      </div>
    </div>
  );
}