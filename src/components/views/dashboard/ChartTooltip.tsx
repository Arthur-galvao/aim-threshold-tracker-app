import { useI18n } from "@/lib/i18n";
import type { DaySummary } from "@/lib/day-summary";
import { formatSensSummary } from "@/lib/chart-format";

export interface ChartTooltipProps {
  item: DaySummary & { ma3: number };
  xPos: number;
  totalWidth: number;
}

export function ChartTooltip({ item, xPos, totalWidth }: ChartTooltipProps) {
  const { t } = useI18n();

  const ratio = totalWidth > 0 ? xPos / totalWidth : 0;
  const pointPercent = ratio * 100;
  // Abre para o lado com mais espaço: nunca centraliza no ponto (vazava do card nas bordas).
  const openLeft = ratio > 0.5;
  const sens = formatSensSummary(item.sens);

  return (
    <div
      className="absolute z-20 pointer-events-none glass-float p-2.5 rounded-control shadow-float border border-glass-edge-strong text-xs font-mono space-y-1 animate-pop-in w-max min-w-[160px] max-w-[220px]"
      style={{
        ...(openLeft
          ? { right: `calc(${100 - pointPercent}% + 12px)` }
          : { left: `calc(${pointPercent}% + 12px)` }),
        top: "14px",
        transition: "left 140ms cubic-bezier(0.16, 1, 0.3, 1), right 140ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-edge text-[11px] text-text-faint whitespace-nowrap">
        <span>{item.date}</span>
        <span className="tabular">{item.runs} runs</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-main whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-score">
          <span className="w-1.5 h-1.5 rounded-full bg-score inline-block shadow-[0_0_6px_var(--score)]" />
          {t("chart.score")}
        </span>
        <span className="font-bold tabular">{item.best} pts</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-emerald whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald inline-block shadow-[0_0_6px_var(--emerald)]" />
          {t("chart.threshold")}
        </span>
        <span className="font-bold tabular">{item.threshold} pts</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-secondary whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-text-secondary inline-block" />
          {t("chart.avgMoving")}
        </span>
        <span className="tabular">{item.ma3} pts</span>
      </div>
      {sens.count > 0 && (
        <div className="pt-1 border-t border-edge flex items-center justify-between gap-3 text-[10px] text-text-faint whitespace-nowrap">
          <span>{t("metric.sens")}</span>
          <span className="tabular">
            {sens.text}
            {sens.count > 3 && <span className="ml-1 opacity-70">({sens.count})</span>}
          </span>
        </div>
      )}
    </div>
  );
}
