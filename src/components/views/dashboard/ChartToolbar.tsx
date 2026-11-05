import { ChartLineUp, Eye, EyeSlash } from "@phosphor-icons/react";
import { Segmented } from "@/components/ui/Segmented";
import { useI18n } from "@/lib/i18n";
import { useAdvancedStats } from "@/hooks/useAdvancedStats";
import { cn } from "@/lib/utils";

export type ChartPeriod = "7D" | "30D" | "all";

export interface ChartToolbarProps {
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  showTarget: boolean;
  onToggleTarget: () => void;
  showPB: boolean;
  onTogglePB: () => void;
  showMu: boolean;
  onToggleMu: () => void;
}

export function ChartToolbar({
  period,
  onPeriodChange,
  showTarget,
  onToggleTarget,
  showPB,
  onTogglePB,
  showMu,
  onToggleMu,
}: ChartToolbarProps) {
  const { t } = useI18n();
  const advanced = useAdvancedStats();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
      <div className="flex items-center gap-2.5">
        <span className="text-score" aria-hidden="true">
          <ChartLineUp size={20} weight="regular" />
        </span>
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {advanced ? t("skill.chart.title") : t("simple.chart.title")}
          </h2>
          <p className="text-xs text-text-faint">{advanced ? t("skill.chart.subtitle") : t("simple.chart.subtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Series Toggles */}
        <div className="liquid-well p-1 inline-flex items-center gap-1 rounded-control text-xs font-mono">
          <button
            type="button"
            onClick={onToggleTarget}
            className={cn(
              "px-2.5 py-1 rounded-[10px] border transition-all text-xs inline-flex items-center gap-1.5 cursor-pointer press",
              showTarget
                ? "bg-emerald-soft text-emerald border-emerald-edge shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
                : "bg-transparent text-text-faint border-transparent opacity-60 hover:opacity-90"
            )}
            title={t("chart.toggleSeries")}
          >
            {showTarget ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{advanced ? t("skill.series.target") : t("simple.series.target")}</span>
          </button>

          <button
            type="button"
            onClick={onTogglePB}
            className={cn(
              "px-2.5 py-1 rounded-[10px] border transition-all text-xs inline-flex items-center gap-1.5 cursor-pointer press",
              showPB
                ? "bg-score-soft text-score border-edge shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
                : "bg-transparent text-text-faint border-transparent opacity-60 hover:opacity-90"
            )}
            title={t("chart.toggleSeries")}
          >
            {showPB ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{advanced ? t("skill.series.pb") : t("simple.series.best")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMu}
            className={cn(
              "px-2.5 py-1 rounded-[10px] border transition-all text-xs inline-flex items-center gap-1.5 cursor-pointer press",
              showMu
                ? "liquid-pill text-text-main border-edge"
                : "bg-transparent text-text-faint border-transparent opacity-60 hover:opacity-90"
            )}
            title={t("chart.toggleSeries")}
          >
            {showMu ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{advanced ? t("skill.series.mu") : t("simple.series.level")}</span>
          </button>
        </div>

        {/* Time Range Filter */}
        <Segmented
          size="sm"
          value={period}
          onChange={(val) => onPeriodChange(val as ChartPeriod)}
          options={[
            { value: "7D", label: t("chart.period7D") },
            { value: "30D", label: t("chart.period30D") },
            { value: "all", label: t("chart.periodAll") },
          ]}
        />
      </div>
    </div>
  );
}
