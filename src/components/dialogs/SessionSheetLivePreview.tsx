import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import type { SimulatedOutcome } from "@/lib/threshold";
import { roundScore } from "@/lib/metric-deltas";
import { useI18n } from "@/lib/i18n";

export interface SessionSheetLivePreviewProps {
  draftRunsCount: number;
  simulatedOutcome: SimulatedOutcome;
}

export function SessionSheetLivePreview({
  draftRunsCount,
  simulatedOutcome,
}: SessionSheetLivePreviewProps) {
  const { t } = useI18n();
  const { targetBefore, projectedTarget, willHit, willBreakPB, validCount } = simulatedOutcome;

  if (draftRunsCount === 0) {
    return (
      <div className="glass-inset p-3 text-center text-xs font-mono text-text-faint">
        {t("skill.sim.typeScores")}
      </div>
    );
  }

  const fmt = (v: number | null) => (v === null ? "—" : String(roundScore(v)));
  const notCounted = validCount === 0 ? t("skill.sim.noneCounted") : null;

  if (willHit) {
    return (
      <div className="p-3.5 rounded-control bg-emerald-soft border border-emerald-edge flex items-start gap-2.5 text-emerald">
        <CheckCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
        <div className="text-xs font-mono leading-relaxed">
          <span className="font-bold uppercase tracking-wider block text-[11px]">
            {t("skill.sim.hit")}
          </span>
          <span className="block mt-0.5 font-bold tabular-nums">
            {t("skill.sim.targetChange", { from: fmt(targetBefore), to: fmt(projectedTarget) })}
            {willBreakPB && ` · ${t("skill.sim.newPb")}`}
          </span>
          {notCounted && <span className="block mt-0.5 opacity-80">{notCounted}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-control bg-amber-soft border border-amber-edge flex items-start gap-2.5 text-amber">
      <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5" />
      <div className="text-xs font-mono leading-relaxed">
        <span className="font-bold uppercase tracking-wider block text-[11px]">
          {targetBefore === null ? t("skill.sim.firstSession") : t("skill.sim.miss")}
        </span>
        <span className="block mt-0.5 font-bold tabular-nums">
          {t("skill.sim.targetChange", { from: fmt(targetBefore), to: fmt(projectedTarget) })}
          {willBreakPB && ` · ${t("skill.sim.newPb")}`}
        </span>
        {notCounted && <span className="block mt-0.5 opacity-80">{notCounted}</span>}
      </div>
    </div>
  );
}
