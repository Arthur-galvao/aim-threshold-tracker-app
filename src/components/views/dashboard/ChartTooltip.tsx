import { useI18n } from "@/lib/i18n";
import type { ChartRunPoint, ChartSessionStep } from "@/lib/day-summary";
import { roundScore } from "@/lib/metric-deltas";

export interface ChartTooltipProps {
  run: ChartRunPoint;
  step: ChartSessionStep;
  xPos: number;
  totalWidth: number;
}

export function ChartTooltip({ run, step, xPos, totalWidth }: ChartTooltipProps) {
  const { t, lang } = useI18n();

  const ratio = totalWidth > 0 ? xPos / totalWidth : 0;
  const pointPercent = ratio * 100;
  // Abre para o lado com mais espaço: nunca centraliza no ponto (vazava do card nas bordas).
  const openLeft = ratio > 0.5;
  const when = new Date(run.t).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      className="absolute z-20 pointer-events-none glass-float p-2.5 rounded-control shadow-float border border-glass-edge-strong text-xs font-mono space-y-1 animate-pop-in w-max min-w-[170px] max-w-[240px]"
      style={{
        ...(openLeft
          ? { right: `calc(${100 - pointPercent}% + 12px)` }
          : { left: `calc(${pointPercent}% + 12px)` }),
        top: "14px",
        transition: "left 140ms cubic-bezier(0.16, 1, 0.3, 1), right 140ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-edge text-[11px] text-text-faint whitespace-nowrap">
        <span>{when}</span>
        <span className="tabular">{run.sens} cm</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-text-main whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-score">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              run.valid ? "bg-score shadow-[0_0_6px_var(--score)]" : "border border-score"
            }`}
          />
          {t("chart.score")}
        </span>
        <span className="font-bold tabular">{run.score} pts</span>
      </div>
      {run.valid ? (
        <div className="text-[10px] text-emerald whitespace-nowrap">{t("skill.run.valid")}</div>
      ) : (
        <div className="text-[10px] text-amber whitespace-normal leading-snug">
          <span className="font-semibold block">
            {t("skill.run.invalid")}
            {run.reason ? `: ${t(`skill.reason.${run.reason}`)}` : ""}
          </span>
          {run.reason && (
            <span className="text-text-faint font-sans">{t(`skill.reasonDesc.${run.reason}`)}</span>
          )}
        </div>
      )}
      {step.target !== null && (
        <div className="flex items-center justify-between gap-3 text-emerald whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald inline-block shadow-[0_0_6px_var(--emerald)]" />
            {t("skill.chart.sessionTarget")}
          </span>
          <span className="font-bold tabular">{roundScore(step.target)} pts</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 text-text-secondary whitespace-nowrap">
        <span>{t("skill.series.mu")}</span>
        <span className="tabular">{Number.isFinite(step.mu) ? roundScore(step.mu) : "—"} pts</span>
      </div>
      {step.hit !== null && (
        <div
          className={`text-[10px] whitespace-nowrap ${step.hit ? "text-emerald" : "text-amber"}`}
        >
          {step.hit ? t("chart.tooltipHit") : t("chart.tooltipMiss")}
        </div>
      )}
    </div>
  );
}
