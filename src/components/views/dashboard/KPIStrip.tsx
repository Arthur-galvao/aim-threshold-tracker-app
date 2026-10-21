import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Info,
  Lightning,
  ShieldCheck,
  Target,
  TrendUp,
  Trophy,
} from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import {
  buildEscalateFormat,
  computeTaskMetrics,
  estimateSessionThreshold,
} from "@/lib/threshold";
import { summarizeDays } from "@/lib/day-summary";
import { computeMetricDeltas } from "@/lib/metric-deltas";
import { useI18n } from "@/lib/i18n";
import { Badge, Button, NumberTicker, Tooltip, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface KPIStripProps {
  className?: string;
}

export function KPIStrip({ className }: KPIStripProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { state, meta } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { simulatedOutcome } = meta;

  const [simScoreInput, setSimScoreInput] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);
  const taskMetrics = useMemo(() => computeTaskMetrics(activeTask), [activeTask]);
  const deltas = useMemo(() => computeMetricDeltas(activeTask), [activeTask]);
  const summaries = useMemo(() => summarizeDays(activeTask), [activeTask]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const todaySummary = summaries.find((d) => d.date === todayStr) ?? null;

  const currentThreshold =
    taskMetrics.targetThreshold ?? computedMetrics.currentThreshold;
  const todayTarget = hasData
    ? (todaySummary?.targetBefore ?? currentThreshold)
    : null;

  const todayProgressPct =
    todaySummary && todayTarget && todayTarget > 0
      ? Math.min(100, Math.round((todaySummary.best / todayTarget) * 100))
      : 0;

  const ratioPct =
    taskMetrics.maxPB && currentThreshold && taskMetrics.maxPB > 0
      ? ((currentThreshold / taskMetrics.maxPB) * 100).toFixed(1)
      : null;

  const ratchetBadge = useMemo(() => {
    if (computedMetrics.ratchetStatus === "ratchet_up") {
      const delta =
        simulatedOutcome.thresholdDelta > 0
          ? `+${simulatedOutcome.thresholdDelta}`
          : "";
      return {
        variant: "emerald" as const,
        label: `${t("dashboard.ratchetUp")} ${delta}`.trim(),
      };
    }
    if (computedMetrics.ratchetStatus === "plateau_held") {
      return {
        variant: "amber" as const,
        label: t("dashboard.ratchetHeld"),
      };
    }
    return {
      variant: "neutral" as const,
      label: t("dashboard.ratchetInitial"),
    };
  }, [computedMetrics.ratchetStatus, simulatedOutcome.thresholdDelta, t]);

  const consistencyBadge = useMemo(() => {
    if (taskMetrics.hitRate === null) return null;
    if (taskMetrics.hitRate >= 80) {
      return { variant: "emerald" as const, label: t("metric.consistencyHigh") };
    }
    if (taskMetrics.hitRate >= 60) {
      return { variant: "amber" as const, label: t("metric.consistencyMed") };
    }
    return { variant: "neutral" as const, label: t("metric.consistencyVar") };
  }, [taskMetrics.hitRate, t]);

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

  const handleCopyEscalate = () => {
    if (!activeTask || !activeTask.sessions.length) {
      showToast(t("toast.noData"), "error");
      return;
    }
    const text = buildEscalateFormat(activeTask);
    if (!text) {
      showToast(t("toast.noData"), "error");
      return;
    }
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    showToast(t("toast.copiedEscalate"), "success");
  };

  return (
    <section
      className={cn(
        "liquid-surface liquid-interactive overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-edge",
        className
      )}
    >
      {/* Zone 1 (5 cols): Focal Ratchet Command & Live Score Simulator */}
      <div className="group/z1 lg:col-span-5 p-5 flex flex-col justify-between gap-4 transition-colors duration-300 hover:bg-white/[0.012]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-emerald inline-flex transition-transform duration-300 group-hover/z1:scale-110"
                aria-hidden="true"
              >
                <ShieldCheck size={18} weight="fill" />
              </span>
              <span className="text-xs font-semibold text-text-secondary">
                {t("dashboard.kpiThreat")}
              </span>
              <Tooltip content={t("metric.targetExplanation")}>
                <span className="text-text-faint hover:text-text-main transition-transform duration-200 hover:scale-110 cursor-pointer inline-flex">
                  <Info size={13} />
                </span>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1.5">
              {taskMetrics.streak > 0 && (
                <Badge variant="amber">
                  {t("metric.streak", { n: taskMetrics.streak })}
                </Badge>
              )}
              <Badge variant={ratchetBadge.variant}>{ratchetBadge.label}</Badge>
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3 pt-1">
            <div className="flex items-baseline gap-2">
              {hasData && currentThreshold !== null ? (
                <NumberTicker
                  value={currentThreshold}
                  decimalPlaces={Number.isInteger(currentThreshold) ? 0 : 1}
                  className="text-4xl font-bold tracking-tight text-text-main tabular"
                />
              ) : (
                <span className="text-4xl font-bold tracking-tight text-text-faint font-mono tabular">
                  —
                </span>
              )}
              <span className="text-xs font-mono text-text-faint tabular">
                {t("metric.pts")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-secondary tabular">
                {ratioPct ? t("metric.thresholdRatio", { pct: ratioPct }) : "—"}
              </span>
              {hasData && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyEscalate}
                  icon={
                    copied ? (
                      <Check size={13} weight="bold" className="text-emerald animate-pop-in" />
                    ) : (
                      <Copy size={13} weight="regular" />
                    )
                  }
                  className={cn(
                    "h-7 px-2.5 text-[11px] rounded-full transition-all",
                    copied && "border-emerald-edge text-emerald bg-emerald-soft"
                  )}
                >
                  {t("hist.copy")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Recessed Simulator Well with reactive status border */}
        <div
          className={cn(
            "liquid-well px-3 py-2 flex items-center justify-between gap-2.5 transition-all duration-200 focus-within:border-score/50 focus-within:shadow-[0_0_16px_rgb(var(--score-rgb)/0.16)]",
            liveSim &&
              (liveSim.willRaise
                ? "border-emerald-edge shadow-[0_0_18px_rgb(var(--emerald-rgb)/0.18)]"
                : "border-amber-edge")
          )}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Lightning
              size={13}
              weight="fill"
              className={cn(
                "text-amber shrink-0 transition-transform duration-200",
                liveSim && "scale-125"
              )}
            />
            <input
              type="number"
              value={simScoreInput}
              onChange={(e) => setSimScoreInput(e.target.value)}
              placeholder={t("dashboard.testScorePh")}
              aria-label={t("dashboard.simulatedOutcome")}
              className="w-24 bg-transparent text-xs font-mono text-text-main placeholder:text-text-faint focus:outline-none tabular"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono truncate">
            {liveSim ? (
              <div className="flex items-center gap-1.5 animate-pop-in">
                <Badge variant={liveSim.willRaise ? "emerald" : "amber"}>
                  {liveSim.willRaise
                    ? `+${liveSim.delta} pts`
                    : t("dashboard.ratchetHeld")}
                </Badge>
                <span className="text-text-secondary tabular">
                  <strong className="text-emerald">
                    {liveSim.projectedThreshold}
                  </strong>
                </span>
                {liveSim.willBreakPB && <Badge variant="amber">PB</Badge>}
              </div>
            ) : (
              <span className="text-text-faint truncate">
                {t("dashboard.ratchetProtected")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Zone 2 (4 cols): Daily Target & Today's Execution */}
      <div className="group/z2 lg:col-span-4 p-5 flex flex-col justify-between gap-4 transition-colors duration-300 hover:bg-white/[0.012]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-score inline-flex transition-transform duration-300 group-hover/z2:rotate-12 group-hover/z2:scale-110"
                aria-hidden="true"
              >
                <Target size={18} weight="regular" />
              </span>
              <span className="text-xs font-semibold text-text-secondary">
                {t("metric.todayTarget")}
              </span>
            </div>
            {todaySummary ? (
              <Badge variant={todaySummary.hit ? "emerald" : "score"}>
                {todaySummary.hit ? "HIT" : `${todayProgressPct}%`}
              </Badge>
            ) : (
              <span className="text-[11px] font-mono text-text-faint">
                {t("dashboard.nextRung")}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 pt-1">
            {hasData && todayTarget !== null ? (
              <NumberTicker
                value={todayTarget}
                decimalPlaces={Number.isInteger(todayTarget) ? 0 : 1}
                className="text-3xl font-bold tracking-tight text-score tabular"
              />
            ) : (
              <span className="text-3xl font-bold tracking-tight text-text-faint font-mono tabular">
                —
              </span>
            )}
            <span className="text-xs font-mono text-text-faint tabular">
              {t("metric.pts")}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full h-2 rounded-full liquid-well overflow-hidden p-0.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out relative",
                todaySummary?.hit
                  ? "bg-emerald shadow-[0_0_12px_rgb(var(--emerald-rgb)/0.65)]"
                  : "bg-score shadow-[0_0_12px_rgb(var(--score-rgb)/0.65)]"
              )}
              style={{ width: `${Math.max(todayProgressPct, hasData ? 4 : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-text-faint tabular">
            <span className="truncate">
              {todaySummary
                ? t("metric.todayRuns", {
                    best: todaySummary.best,
                    runs: todaySummary.runs,
                  })
                : t("metric.noRunsToday")}
            </span>
            <span>{todayProgressPct}%</span>
          </div>
        </div>
      </div>

      {/* Zone 3 (3 cols): Personal Best & Hit Rate Consistency */}
      <div className="group/z3 lg:col-span-3 p-5 flex flex-col justify-between gap-3 transition-colors duration-300 hover:bg-white/[0.012]">
        {/* Top half: Personal Best */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Trophy
                size={15}
                weight="regular"
                className="text-amber transition-transform duration-300 group-hover/z3:-translate-y-0.5 group-hover/z3:scale-110"
              />
              <span>{t("metric.pb")}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              {hasData && taskMetrics.maxPB !== null ? (
                <NumberTicker
                  value={taskMetrics.maxPB}
                  decimalPlaces={Number.isInteger(taskMetrics.maxPB) ? 0 : 1}
                  className="text-2xl font-bold tracking-tight text-text-main tabular"
                />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-text-faint font-mono tabular">
                  —
                </span>
              )}
              <span className="text-[11px] font-mono text-text-faint tabular">
                {t("metric.pts")}
              </span>
            </div>
          </div>

          <div className="text-right space-y-1">
            {deltas.scoreDelta !== null && deltas.scoreDelta !== 0 && (
              <div>
                <Badge variant={deltas.scoreDelta > 0 ? "emerald" : "red"}>
                  {deltas.scoreDelta > 0
                    ? `+${deltas.scoreDelta}`
                    : deltas.scoreDelta}
                </Badge>
              </div>
            )}
            <span className="block text-[11px] font-mono text-text-faint tabular">
              {t("metric.sessionsCount", {
                n: activeTask?.sessions?.length ?? 0,
              })}
            </span>
          </div>
        </div>

        <div className="border-t border-edge" />

        {/* Bottom half: Hit Rate & Consistency */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <TrendUp
                size={15}
                weight="regular"
                className="text-score transition-transform duration-300 group-hover/z3:translate-x-0.5 group-hover/z3:-translate-y-0.5"
              />
              <span>{t("metric.consistency")}</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              {hasData && taskMetrics.hitRate !== null ? (
                <NumberTicker
                  value={taskMetrics.hitRate}
                  decimalPlaces={0}
                  className="text-2xl font-bold tracking-tight text-text-main tabular"
                />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-text-faint font-mono tabular">
                  —
                </span>
              )}
              <span className="text-xs font-mono text-text-faint tabular">%</span>
            </div>
          </div>

          <div className="text-right space-y-1">
            {consistencyBadge && (
              <div>
                <Badge variant={consistencyBadge.variant}>
                  {consistencyBadge.label}
                </Badge>
              </div>
            )}
            <span className="block text-[11px] font-mono text-text-faint tabular">
              Threshold / PB:{" "}
              <strong className="text-text-secondary">
                {computedMetrics.consistencyRatio !== null
                  ? `${computedMetrics.consistencyRatio.toFixed(1)}%`
                  : "—"}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
