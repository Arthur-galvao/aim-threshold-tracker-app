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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* PB Card */}
      <div className="panel p-5 rounded-2xl flex flex-col justify-between hover:border-edge-strong transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("metric.pb")}
          </span>
          <div className="w-8 h-8 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center group-hover:text-text-main group-hover:border-edge-strong transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums transition-colors ${
            metrics.maxPB !== null ? "text-text-main" : "text-text-faint/40"
          }`}>
            {metrics.maxPB ?? "0"}
          </span>
          <span className="text-xs font-medium text-text-faint">
            {t("metric.pts")}
          </span>
        </div>
      </div>

      {/* Target Threshold Card */}
      <div className="panel p-5 rounded-2xl flex flex-col justify-between hover:border-edge-strong transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("metric.threshold")}
          </span>
          <div className="w-8 h-8 rounded-full bg-surface-subtle text-amber border border-edge flex items-center justify-center group-hover:border-edge-strong transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
            metrics.targetThreshold !== null ? "text-amber" : "text-amber/40"
          }`}>
            {metrics.targetThreshold ?? "0"}
          </span>
          <span className="text-xs font-medium text-text-faint">
            {t("metric.target")}
          </span>
        </div>
      </div>

      {/* Consistency Card */}
      <div className="panel p-5 rounded-2xl flex flex-col justify-between hover:border-edge-strong transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("metric.consistency")}
          </span>
          <div className="w-8 h-8 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center group-hover:text-text-main group-hover:border-edge-strong transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
            metrics.consistency !== null ? "text-text-main" : "text-text-faint/40"
          }`}>
            {metrics.consistency !== null ? `${metrics.consistency}%` : "0%"}
          </span>
        </div>
      </div>

      {/* Sensitivity Card */}
      <div className="panel p-5 rounded-2xl flex flex-col justify-between hover:border-edge-strong transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t("metric.sens")}
          </span>
          <div className="w-8 h-8 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center group-hover:text-text-main group-hover:border-edge-strong transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="7" />
              <line x1="12" y1="6" x2="12" y2="10" />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
            metrics.lastSens !== null ? "text-text-main" : "text-text-faint/40"
          }`}>
            {metrics.lastSens ?? "0"}
          </span>
          <span className="text-xs font-medium text-text-faint">cm/360</span>
        </div>
      </div>
    </div>

  );
}