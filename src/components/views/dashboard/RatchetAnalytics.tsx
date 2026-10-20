import { useState, useMemo } from "react";
import { ShieldCheck, Info, Lightning } from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { estimateSessionThreshold } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { Badge, NumberTicker, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface RatchetAnalyticsProps {
  className?: string;
}

export function RatchetAnalytics({ className }: RatchetAnalyticsProps) {
  const { t } = useI18n();
  const { state } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { currentThreshold, dailyTarget, ratchetStatus } = computedMetrics;

  const [simScoreInput, setSimScoreInput] = useState<string>("");

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);

  const lastSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    const sorted = [...activeTask.sessions].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1];
  }, [activeTask?.sessions]);

  // Current progress toward next ratchet rung
  const progressPct = useMemo(() => {
    if (!currentThreshold || !lastSession) return 0;
    const currentScore = Number(lastSession.pb) || 0;
    if (currentScore <= 0) return 0;
    return Math.min(100, Math.round((currentScore / currentThreshold) * 100));
  }, [currentThreshold, lastSession]);

  // Interactive live test simulation
  const liveSim = useMemo(() => {
    const val = parseFloat(simScoreInput);
    if (isNaN(val) || val <= 0) return null;

    const estimated = estimateSessionThreshold(activeTask, [val]);
    const nextThresh = estimated.threshold ?? currentThreshold ?? val;
    const delta = currentThreshold !== null ? nextThresh - currentThreshold : 0;
    const currentPB =
      activeTask?.sessions && activeTask.sessions.length > 0
        ? Math.max(...activeTask.sessions.map((s) => s.pb))
        : 0;

    return {
      inputScore: val,
      projectedThreshold: nextThresh,
      delta: Math.round(delta * 10) / 10,
      willRaise: delta > 0,
      willBreakPB: val > currentPB,
    };
  }, [simScoreInput, activeTask, currentThreshold]);

  return (
    <div className={cn("glass p-5 flex flex-col justify-between", className)}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 select-none mb-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald" aria-hidden="true">
              <ShieldCheck size={20} weight="regular" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[13px] font-semibold text-text-secondary">
                  {t("dashboard.ratchetTitle")}
                </h2>
                <Tooltip content={t("metric.targetExplanation")}>
                  <span className="text-text-faint hover:text-text-main cursor-pointer">
                    <Info size={14} />
                  </span>
                </Tooltip>
              </div>
              <p className="text-xs text-text-faint">{t("dashboard.ratchetSubtitle")}</p>
            </div>
          </div>

          <Badge
            variant={
              ratchetStatus === "ratchet_up"
                ? "emerald"
                : ratchetStatus === "plateau_held"
                ? "amber"
                : "neutral"
            }
          >
            {ratchetStatus === "ratchet_up"
              ? t("dashboard.ratchetUp")
              : ratchetStatus === "plateau_held"
              ? t("dashboard.ratchetHeld")
              : t("dashboard.ratchetInitial")}
          </Badge>
        </div>

        {/* Status & Next Rung Info */}
        <div className="p-3.5 rounded-control glass-inset border border-edge mb-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-mono text-text-faint uppercase block">
                {t("dashboard.nextRung")}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                {hasData && dailyTarget !== null ? (
                  <NumberTicker
                    value={dailyTarget}
                    decimalPlaces={Number.isInteger(dailyTarget) ? 0 : 1}
                    className="text-2xl font-bold tracking-tight text-emerald"
                  />
                ) : (
                  <span className="text-2xl font-bold tracking-tight text-text-faint font-mono tabular">
                    —
                  </span>
                )}
                <span className="text-xs font-mono text-text-faint tabular">{t("metric.pts")}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-emerald font-semibold tabular">
                {progressPct}% {t("dashboard.toNextRung")}
              </span>
              <span className="text-[10px] font-mono text-text-faint block mt-0.5">
                {t("dashboard.ratchetProtected")}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Simulation Testing Panel */}
      <div className="pt-3 border-t border-edge">
        <div className="flex items-center gap-1.5 mb-2 select-none">
          <Lightning size={14} className="text-amber" />
          <span className="text-xs font-semibold text-text-secondary">
            {t("dashboard.simulatedOutcome")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={simScoreInput}
            onChange={(e) => setSimScoreInput(e.target.value)}
            placeholder={t("dashboard.testScorePh")}
            className="w-24 h-8 px-2.5 text-xs font-mono rounded-control field tabular"
          />

          {liveSim ? (
            <div className="flex items-center gap-2 text-xs font-mono">
              <Badge variant={liveSim.willRaise ? "emerald" : "amber"}>
                {liveSim.willRaise
                  ? `+${liveSim.delta} pts`
                  : t("dashboard.ratchetHeld")}
              </Badge>
              <span className="text-text-secondary tabular">
                {t("chart.threshold")}: <strong className="text-emerald">{liveSim.projectedThreshold} pts</strong>
              </span>
              {liveSim.willBreakPB && (
                <Badge variant="amber">NOVO PB!</Badge>
              )}
            </div>
          ) : (
            <span className="text-[11px] font-mono text-text-faint">
              {t("session.detailTypeScores")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
