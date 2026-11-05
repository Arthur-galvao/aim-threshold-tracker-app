import { useMemo } from "react";
import { Target, TrendUp, TrendDown, Minus, Question } from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import type { InvalidReason } from "@/lib/skill";
import { roundScore } from "@/lib/metric-deltas";
import { useI18n } from "@/lib/i18n";
import { useAdvancedStats } from "@/hooks/useAdvancedStats";
import { Badge, NumberTicker } from "@/components/ui";
import { InfoTip } from "./InfoTip";
import { cn } from "@/lib/utils";

export interface TargetAnalyticsProps {
  className?: string;
}

const REASONS: InvalidReason[] = [
  "warmup",
  "paused",
  "no_score",
  "off_center_unadjustable",
  "manual_excluded",
];

export function TargetAnalytics({ className }: TargetAnalyticsProps) {
  const { t } = useI18n();
  const advanced = useAdvancedStats();
  const { state } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { skill, nextTarget, nextStretch, trend, trendSlopePct } = computedMetrics;

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);

  const invalidRows = useMemo(() => {
    if (!skill) return [];
    return REASONS.map((reason) => ({ reason, n: skill.invalidCounts[reason] ?? 0 })).filter(
      (r) => r.n > 0
    );
  }, [skill]);
  const invalidTotal = invalidRows.reduce((acc, r) => acc + r.n, 0);

  const trendVariant =
    trend === "up" ? "emerald" : trend === "down" ? "red" : trend === "flat" ? "amber" : "neutral";
  const TrendIcon = trend === "up" ? TrendUp : trend === "down" ? TrendDown : trend === "flat" ? Minus : Question;

  if (!advanced) {
    return (
      <div className={cn("glass p-5 flex flex-col gap-4", className)}>
        <div className="flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2">
            <span className="text-emerald" aria-hidden="true">
              <Target size={20} weight="regular" />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold text-text-secondary">
                {t("simple.analytics.title")}
              </h2>
              <p className="text-xs text-text-faint">{t("simple.analytics.subtitle")}</p>
            </div>
          </div>
          <Badge variant={trendVariant}>
            <span className="inline-flex items-center gap-1">
              <TrendIcon size={12} weight="bold" />
              {t("simple.kpi.progress", { word: t(`simple.trend.${trend}`) })}
            </span>
          </Badge>
        </div>

        <p className="text-xs text-text-secondary leading-snug">
          {hasData
            ? t(
                trend === "up"
                  ? "simple.analytics.trendUp"
                  : trend === "down"
                    ? "simple.analytics.trendDown"
                    : trend === "flat"
                      ? "simple.analytics.trendFlat"
                      : "simple.analytics.trendInsufficient"
              )
            : t("simple.analytics.trendInsufficient")}
        </p>

        {skill?.difficultyHint && (
          <div className="p-3 rounded-control bg-amber-soft border border-amber-edge text-xs text-amber leading-snug">
            {t(`simple.difficultyHint.${skill.difficultyHint}`)}
          </div>
        )}

        <div className="pt-3 border-t border-edge space-y-2">
          <div className="text-xs font-semibold text-text-secondary select-none">
            {invalidTotal === 0
              ? t("simple.analytics.noneUncounted")
              : `${t("simple.analytics.uncounted", { n: invalidTotal })} (${invalidRows
                  .map((r) => `${t(`simple.reason.${r.reason}`).toLowerCase()} ${r.n}`)
                  .join(", ")})`}
          </div>
          {invalidRows.length > 0 && (
            <ul className="space-y-1">
              {invalidRows.map((row) => (
                <li key={row.reason} className="text-[11px] text-text-faint leading-snug">
                  <span className="text-text-secondary font-semibold">
                    {t(`simple.reason.${row.reason}`)}:
                  </span>{" "}
                  {t(`simple.reasonDesc.${row.reason}`)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("glass p-5 flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="text-emerald" aria-hidden="true">
            <Target size={20} weight="regular" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-[13px] font-semibold text-text-secondary">
                {t("skill.analytics.title")}
              </h2>
              <InfoTip text={t("skill.explain.target")} size={14} />
            </div>
            <p className="text-xs text-text-faint">{t("skill.analytics.subtitle")}</p>
          </div>
        </div>
        <Badge variant={trendVariant}>
          <span className="inline-flex items-center gap-1">
            <TrendIcon size={12} weight="bold" />
            {t(`skill.trend.${trend}`)}
          </span>
        </Badge>
      </div>

      <div className="p-3.5 rounded-control glass-inset border border-edge grid grid-cols-2 gap-3">
        <div>
          <span className="text-[11px] font-mono text-text-faint uppercase block">
            {t("skill.kpi.nextTarget")}
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            {hasData && nextTarget !== null ? (
              <NumberTicker
                value={roundScore(nextTarget)}
                decimalPlaces={Number.isInteger(roundScore(nextTarget)) ? 0 : 1}
                className="text-2xl font-bold tracking-tight text-emerald"
              />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-text-faint font-mono tabular">—</span>
            )}
            <span className="text-xs font-mono text-text-faint tabular">{t("metric.pts")}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-text-faint uppercase block">
            {t("skill.analytics.slope")}
          </span>
          <span className="text-lg font-bold tabular font-mono text-text-main">
            {trendSlopePct === null
              ? "—"
              : `${trendSlopePct > 0 ? "+" : ""}${trendSlopePct.toFixed(2)}%`}
          </span>
          <span className="text-[10px] font-mono text-text-faint block">
            {t("skill.analytics.perSession")}
          </span>
        </div>
        {nextStretch !== null && (
          <div className="col-span-2 text-[11px] font-mono text-text-faint tabular">
            {t("skill.kpi.stretch", { val: roundScore(nextStretch) })}
          </div>
        )}
      </div>

      {skill?.difficultyHint && (
        <div className="p-3 rounded-control bg-amber-soft border border-amber-edge text-xs text-amber leading-snug">
          {t(`skill.difficultyHint.${skill.difficultyHint}`)}
        </div>
      )}

      <div className="pt-3 border-t border-edge space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary select-none">
          <span>{t("skill.analytics.invalidRuns")}</span>
          <InfoTip text={t("skill.explain.invalidRun")} />
          <span className="ml-auto font-mono tabular text-text-faint">{invalidTotal}</span>
        </div>
        {invalidRows.length === 0 ? (
          <p className="text-[11px] font-mono text-text-faint">{t("skill.analytics.noInvalid")}</p>
        ) : (
          <ul className="space-y-1">
            {invalidRows.map((row) => (
              <li
                key={row.reason}
                className="flex items-center justify-between gap-2 text-[11px] font-mono text-text-secondary"
              >
                <span className="flex items-center gap-1.5">
                  {t(`skill.reason.${row.reason}`)}
                  <InfoTip text={t(`skill.reasonDesc.${row.reason}`)} size={12} />
                </span>
                <span className="tabular text-text-main">{row.n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TargetAnalytics;
