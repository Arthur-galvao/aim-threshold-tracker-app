import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import type { SimulatedOutcome } from "@/context/TrackerWorkspaceContext";
import { useI18n } from "@/lib/i18n";

export interface SessionSheetLivePreviewProps {
  draftRunsCount: number;
  currentThreshold: number | null;
  simulatedOutcome: SimulatedOutcome;
}

export function SessionSheetLivePreview({
  draftRunsCount,
  currentThreshold,
  simulatedOutcome,
}: SessionSheetLivePreviewProps) {
  const { t } = useI18n();

  if (draftRunsCount === 0) {
    return (
      <div className="glass-inset p-3 text-center text-xs font-mono text-text-faint">
        {t("session.detailTypeScores")}
      </div>
    );
  }

  if (simulatedOutcome.willRaiseRatchet) {
    return (
      <div className="p-3.5 rounded-control bg-emerald-soft border border-emerald-edge flex items-start gap-2.5 text-emerald">
        <CheckCircle size={18} weight="fill" className="shrink-0 mt-0.5" />
        <div className="text-xs font-mono leading-relaxed">
          <span className="font-bold uppercase tracking-wider block text-[11px]">
            {t("session.newThreshold")}
          </span>
          <span className="block mt-0.5 font-bold tabular-nums">
            Threshold: {currentThreshold ?? "—"} → {simulatedOutcome.projectedThreshold} pts (+{simulatedOutcome.thresholdDelta})
            {simulatedOutcome.willBreakPB && " · Novo Recorde (PB)!"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-control bg-amber-soft border border-amber-edge flex items-start gap-2.5 text-amber">
      <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5" />
      <div className="text-xs font-mono leading-relaxed">
        <span className="font-bold uppercase tracking-wider block text-[11px]">
          Platô Protegido (Zero Regressão)
        </span>
        <span className="block mt-0.5 font-bold tabular-nums">
          Threshold travado em: {currentThreshold ?? "—"} pts
        </span>
      </div>
    </div>
  );
}
