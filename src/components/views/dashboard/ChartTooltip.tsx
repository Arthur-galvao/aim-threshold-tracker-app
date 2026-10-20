import { useI18n } from "@/lib/i18n";
import type { DaySummary } from "@/lib/day-summary";

export interface ChartTooltipProps {
  item: DaySummary & { ma3: number };
  xPos: number;
  totalWidth: number;
}

export function ChartTooltip({ item, xPos, totalWidth }: ChartTooltipProps) {
  const { t } = useI18n();

  const leftPercent = Math.min(Math.max(10, (xPos / totalWidth) * 100), 80);

  return (
    <div
      className="absolute z-20 pointer-events-none glass-float p-2.5 rounded-control shadow-float border border-edge text-xs font-mono space-y-1 transition-all duration-75 min-w-[140px]"
      style={{
        left: `${leftPercent}%`,
        top: "16px",
        transform: "translateX(-50%)",
      }}
    >
      <div className="flex items-center justify-between pb-1 border-b border-edge text-[11px] text-text-faint">
        <span>{item.date}</span>
        <span className="tabular">{item.runs} runs</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-main">
        <span className="flex items-center gap-1.5 text-score">
          <span className="w-1.5 h-1.5 rounded-full bg-score inline-block" />
          {t("chart.score")}
        </span>
        <span className="font-bold tabular">{item.best} pts</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-emerald">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald inline-block" />
          {t("chart.threshold")}
        </span>
        <span className="font-bold tabular">{item.threshold} pts</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary inline-block" />
          {t("chart.avgMoving")}
        </span>
        <span className="tabular">{item.ma3} pts</span>
      </div>
      {item.sens.length > 0 && (
        <div className="pt-1 border-t border-edge flex items-center justify-between text-[10px] text-text-faint">
          <span>{t("metric.sens")}</span>
          <span className="tabular">{item.sens.join(", ")} cm</span>
        </div>
      )}
    </div>
  );
}
