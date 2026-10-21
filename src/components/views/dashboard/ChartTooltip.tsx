import { useI18n } from "@/lib/i18n";
import type { DaySummary } from "@/lib/day-summary";

export interface ChartTooltipProps {
  item: DaySummary & { ma3: number };
  xPos: number;
  totalWidth: number;
}

export function ChartTooltip({ item, xPos, totalWidth }: ChartTooltipProps) {
  const { t } = useI18n();

  const leftPercent = Math.min(Math.max(12, (xPos / totalWidth) * 100), 86);

  return (
    <div
      className="absolute z-20 pointer-events-none glass-float p-2.5 rounded-control shadow-float border border-glass-edge-strong text-xs font-mono space-y-1 animate-pop-in min-w-[148px]"
      style={{
        left: `${leftPercent}%`,
        top: "14px",
        transform: "translateX(-50%)",
        transition: "left 140ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className="flex items-center justify-between pb-1 border-b border-edge text-[11px] text-text-faint">
        <span>{item.date}</span>
        <span className="tabular">{item.runs} runs</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-main">
        <span className="flex items-center gap-1.5 text-score">
          <span className="w-1.5 h-1.5 rounded-full bg-score inline-block shadow-[0_0_6px_var(--score)]" />
          {t("chart.score")}
        </span>
        <span className="font-bold tabular">{item.best} pts</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-emerald">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald inline-block shadow-[0_0_6px_var(--emerald)]" />
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
