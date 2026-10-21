import { ChartLineUp, Eye, EyeSlash } from "@phosphor-icons/react";
import { Segmented } from "@/components/ui/Segmented";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ChartPeriod = "7D" | "30D" | "all";

export interface ChartToolbarProps {
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  showThreshold: boolean;
  onToggleThreshold: () => void;
  showPB: boolean;
  onTogglePB: () => void;
  showMA3: boolean;
  onToggleMA3: () => void;
}

export function ChartToolbar({
  period,
  onPeriodChange,
  showThreshold,
  onToggleThreshold,
  showPB,
  onTogglePB,
  showMA3,
  onToggleMA3,
}: ChartToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
      <div className="flex items-center gap-2.5">
        <span className="text-score" aria-hidden="true">
          <ChartLineUp size={20} weight="regular" />
        </span>
        <div>
          <h2 className="text-[13px] font-semibold text-text-secondary">
            {t("chart.title")}
          </h2>
          <p className="text-xs text-text-faint">{t("chart.subtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Series Toggles */}
        <div className="liquid-well p-1 inline-flex items-center gap-1 rounded-control text-xs font-mono">
          <button
            type="button"
            onClick={onToggleThreshold}
            className={cn(
              "px-2.5 py-1 rounded-[10px] border transition-all text-xs inline-flex items-center gap-1.5 cursor-pointer press",
              showThreshold
                ? "bg-emerald-soft text-emerald border-emerald-edge shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
                : "bg-transparent text-text-faint border-transparent opacity-60 hover:opacity-90"
            )}
            title={t("chart.toggleSeries")}
          >
            {showThreshold ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{t("dashboard.seriesThreshold")}</span>
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
            <span>{t("dashboard.seriesPB")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMA3}
            className={cn(
              "px-2.5 py-1 rounded-[10px] border transition-all text-xs inline-flex items-center gap-1.5 cursor-pointer press",
              showMA3
                ? "liquid-pill text-text-main border-edge"
                : "bg-transparent text-text-faint border-transparent opacity-60 hover:opacity-90"
            )}
            title={t("chart.toggleSeries")}
          >
            {showMA3 ? <Eye size={13} /> : <EyeSlash size={13} />}
            <span>{t("dashboard.seriesMA3")}</span>
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
