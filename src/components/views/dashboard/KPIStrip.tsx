import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Lightning,
  Target,
  TrendUp,
  Trophy,
  Waveform,
  Barbell,
} from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useAllRuns } from "@/hooks/useSkill";
import { useSettings } from "@/hooks/useSettings";
import { buildEscalateFormat, simulateDraftRuns } from "@/lib/threshold";
import { summarizeTrainingSessions } from "@/lib/day-summary";
import { computeMetricDeltas, roundScore } from "@/lib/metric-deltas";
import { targetAtSens } from "@/lib/skill";
import { skillConfigFromTraining } from "@/lib/skill/config";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Badge, Button, NumberTicker, useToast } from "@/components/ui";
import { InfoTip } from "./InfoTip";
import { cn } from "@/lib/utils";

export interface KPIStripProps {
  className?: string;
}

function decimals(v: number): number {
  return Number.isInteger(roundScore(v)) ? 0 : 1;
}

export function KPIStrip({ className }: KPIStripProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { state } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { skill, nextTarget, nextStretch, mu, cv, personalBest, hitRate14, trend, consistencyRatio } =
    computedMetrics;
  const { settings: randomizerSettings, randomizerState } = useSensRandomizer();
  const { settings } = useSettings();
  const allRuns = useAllRuns();

  const [simScoreInput, setSimScoreInput] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);
  const sessions = useMemo(() => summarizeTrainingSessions(activeTask, skill), [activeTask, skill]);
  const deltas = useMemo(() => computeMetricDeltas(sessions), [sessions]);

  const streak = useMemo(() => {
    if (!skill) return 0;
    let n = 0;
    for (let i = skill.points.length - 1; i >= 0; i--) {
      const hit = skill.points[i].hit;
      if (hit === null) continue;
      if (hit) n++;
      else break;
    }
    return n;
  }, [skill]);

  // Meta equivalente na sens atual do randomizer (só quando o ajuste por sens é confiável).
  const targetHere = useMemo(() => {
    if (!skill || nextTarget === null) return null;
    if (!randomizerSettings.enabled || !skill.model.reliable) return null;
    const sens = randomizerState.activeSensCm;
    if (!sens || sens <= 0) return null;
    const center = randomizerState.activeCenterCm ?? skill.model.centerFallback;
    if (!center || center <= 0) return null;
    return { sens, value: targetAtSens(nextTarget, sens, center, skill.model) };
  }, [skill, nextTarget, randomizerSettings.enabled, randomizerState.activeSensCm, randomizerState.activeCenterCm]);

  const trendBadge = useMemo(() => {
    const variant = trend === "up" ? "emerald" : trend === "down" ? "red" : trend === "flat" ? "amber" : "neutral";
    return { variant: variant as "emerald" | "red" | "amber" | "neutral", label: t(`skill.trend.${trend}`) };
  }, [trend, t]);

  const cvBadge = useMemo(() => {
    if (cv === null) return null;
    if (cv < 0.05) return { variant: "emerald" as const, label: t("metric.consistencyHigh") };
    if (cv < 0.1) return { variant: "amber" as const, label: t("metric.consistencyMed") };
    return { variant: "neutral" as const, label: t("metric.consistencyVar") };
  }, [cv, t]);

  const liveSim = useMemo(() => {
    const val = parseFloat(simScoreInput);
    if (isNaN(val) || val <= 0 || !activeTask) return null;
    const lastSens = activeTask.sessions.slice(-1)[0]?.sens ?? 0;
    const out = simulateDraftRuns(
      activeTask,
      allRuns,
      { scores: [val], sens: lastSens, date: new Date().toISOString().slice(0, 10) },
      skillConfigFromTraining(settings?.training ?? DEFAULT_TRAINING_SETTINGS),
      Date.now()
    );
    return { inputScore: val, ...out };
  }, [simScoreInput, activeTask, allRuns, settings?.training]);

  const handleCopyEscalate = () => {
    if (!activeTask || !activeTask.sessions.length) {
      showToast(t("toast.noData"), "error");
      return;
    }
    const text = buildEscalateFormat(activeTask, skill);
    if (!text) {
      showToast(t("toast.noData"), "error");
      return;
    }
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    showToast(t("toast.copiedEscalate"), "success");
  };

  const bigNumber = (value: number | null, className: string) =>
    hasData && value !== null ? (
      <NumberTicker
        value={roundScore(value)}
        decimalPlaces={decimals(value)}
        className={className}
      />
    ) : (
      <span className={cn(className, "text-text-faint font-mono")}>—</span>
    );

  return (
    <section
      className={cn(
        "liquid-surface liquid-interactive overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-edge",
        className
      )}
    >
      {/* Zona 1: meta da próxima sessão + simulador */}
      <div className="group/z1 lg:col-span-5 p-5 flex flex-col justify-between gap-4 transition-colors duration-300 hover:bg-white/[0.012]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-emerald inline-flex transition-transform duration-300 group-hover/z1:scale-110"
                aria-hidden="true"
              >
                <Target size={18} weight="fill" />
              </span>
              <span className="text-xs font-semibold text-text-secondary">
                {t("skill.kpi.nextTarget")}
              </span>
              <InfoTip text={t("skill.explain.target")} />
            </div>
            <Badge variant={trendBadge.variant}>{trendBadge.label}</Badge>
          </div>

          <div className="flex items-baseline justify-between gap-3 pt-1">
            <div className="flex items-baseline gap-2">
              {bigNumber(nextTarget, "text-4xl font-bold tracking-tight text-text-main tabular")}
              <span className="text-xs font-mono text-text-faint tabular">{t("metric.pts")}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-secondary tabular">
                {consistencyRatio !== null
                  ? t("metric.thresholdRatio", { pct: consistencyRatio.toFixed(1) })
                  : "—"}
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

          <div className="text-[11px] font-mono text-text-faint tabular min-h-[16px] flex flex-wrap items-center gap-x-3">
            {targetHere && (
              <span className="text-emerald">
                {t("skill.kpi.atCurrentSens", {
                  sens: targetHere.sens.toFixed(1),
                  val: roundScore(targetHere.value),
                })}
              </span>
            )}
            {nextStretch !== null && (
              <span>{t("skill.kpi.stretch", { val: roundScore(nextStretch) })}</span>
            )}
            {hasData && nextTarget === null && <span>{t("skill.kpi.noTargetYet")}</span>}
          </div>
        </div>

        {/* Simulador de score */}
        <div
          className={cn(
            "liquid-well px-3 py-2 flex items-center justify-between gap-2.5 transition-all duration-200 focus-within:border-score/50 focus-within:shadow-[0_0_16px_rgb(var(--score-rgb)/0.16)]",
            liveSim &&
              (liveSim.willHit
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
                <Badge variant={liveSim.willHit ? "emerald" : "amber"}>
                  {liveSim.willHit ? t("skill.sim.hit") : t("skill.sim.miss")}
                </Badge>
                {liveSim.projectedTarget !== null && (
                  <span className="text-text-secondary tabular">
                    {t("skill.sim.newTarget")}{" "}
                    <strong className="text-emerald">{roundScore(liveSim.projectedTarget)}</strong>
                  </span>
                )}
                {liveSim.validCount === 0 && (
                  <span className="text-text-faint truncate">{t("skill.sim.notCounted")}</span>
                )}
                {liveSim.willBreakPB && <Badge variant="amber">PB</Badge>}
              </div>
            ) : (
              <span className="text-text-faint truncate">{t("skill.sim.hint")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Zona 2: habilidade (μ) e consistência (CV) */}
      <div className="group/z2 lg:col-span-4 p-5 flex flex-col justify-between gap-4 transition-colors duration-300 hover:bg-white/[0.012]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="text-score inline-flex transition-transform duration-300 group-hover/z2:scale-110"
              aria-hidden="true"
            >
              <Barbell size={18} weight="regular" />
            </span>
            <span className="text-xs font-semibold text-text-secondary">{t("skill.kpi.mu")}</span>
            <InfoTip text={t("skill.explain.mu")} />
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            {bigNumber(mu, "text-3xl font-bold tracking-tight text-score tabular")}
            <span className="text-xs font-mono text-text-faint tabular">{t("metric.pts")}</span>
          </div>
        </div>

        <div className="border-t border-edge" />

        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Waveform size={15} weight="regular" className="text-text-secondary" />
              <span>{t("skill.kpi.cv")}</span>
              <InfoTip text={t("skill.explain.cv")} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              {hasData && cv !== null ? (
                <NumberTicker
                  value={Number((cv * 100).toFixed(1))}
                  decimalPlaces={1}
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
          {cvBadge && <Badge variant={cvBadge.variant}>{cvBadge.label}</Badge>}
        </div>
      </div>

      {/* Zona 3: PB e hit rate */}
      <div className="group/z3 lg:col-span-3 p-5 flex flex-col justify-between gap-3 transition-colors duration-300 hover:bg-white/[0.012]">
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
              {bigNumber(personalBest, "text-2xl font-bold tracking-tight text-text-main tabular")}
              <span className="text-[11px] font-mono text-text-faint tabular">{t("metric.pts")}</span>
            </div>
          </div>

          <div className="text-right space-y-1">
            {deltas.scoreDelta !== null && deltas.scoreDelta !== 0 && (
              <div>
                <Badge variant={deltas.scoreDelta > 0 ? "emerald" : "red"}>
                  {deltas.scoreDelta > 0 ? `+${deltas.scoreDelta}` : deltas.scoreDelta}
                </Badge>
              </div>
            )}
            <span className="block text-[11px] font-mono text-text-faint tabular">
              {t("skill.kpi.sessionsCount", { n: sessions.length })}
            </span>
          </div>
        </div>

        <div className="border-t border-edge" />

        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <TrendUp
                size={15}
                weight="regular"
                className="text-score transition-transform duration-300 group-hover/z3:translate-x-0.5 group-hover/z3:-translate-y-0.5"
              />
              <span>{t("skill.kpi.hitRate")}</span>
              <InfoTip
                text={`${t("skill.explain.hitRate")} ${
                  streak > 0 ? t("skill.kpi.streak", { n: streak }) : t("skill.kpi.noStreak")
                }`}
              />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              {hasData && hitRate14 !== null ? (
                <NumberTicker
                  value={Math.round(hitRate14 * 100)}
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
          {skill?.difficultyHint && (
            <Badge variant="amber">{t(`skill.difficulty.${skill.difficultyHint}`)}</Badge>
          )}
        </div>
      </div>
    </section>
  );
}
