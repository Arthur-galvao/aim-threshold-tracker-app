import { useMemo } from "react";
import { Info, Sparkle, Gauge, Crosshair } from "@phosphor-icons/react";
import { Progress as BaseProgress } from "@base-ui/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatSensitivity } from "@/lib/sens-analytics";
import { cn } from "@/lib/utils";

export interface TelemetryBentoProps {
  className?: string;
  mouseDpi?: number;
}

export function TelemetryBentoTargetCard({ className }: { className?: string }) {
  const { state, meta } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { simulatedOutcome } = meta;
  const { currentThreshold, dailyTarget, ratchetStatus } = computedMetrics;

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);

  const lastSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    const sorted = [...activeTask.sessions].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1];
  }, [activeTask?.sessions]);

  // Calculate progress toward next ratchet rung
  const progressPct = useMemo(() => {
    if (!currentThreshold || !lastSession) return 0;
    const currentScore = Number(lastSession.pb) || 0;
    if (currentScore <= 0) return 0;
    const pct = Math.min(100, Math.round((currentScore / currentThreshold) * 100));
    return pct;
  }, [currentThreshold, lastSession]);

  return (
    <SpotlightCard
      isFeatured
      style={{ "--i": 0 } as React.CSSProperties}
      className={cn(
        "enter lift p-6 flex flex-col justify-between min-h-[148px] liquid-glass-panel border-emerald/30",
        className
      )}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-semibold tracking-[0.08em] uppercase text-text-secondary">
            META DO DIA (CATRACA ASCENDENTE)
          </span>
          <Tooltip content="A catraca sobe quando sua consistência supera a barra atual e trava quedas em dias de baixo desempenho.">
            <span className="cursor-pointer text-text-faint hover:text-text-main transition-colors">
              <Info size={13} weight="bold" />
            </span>
          </Tooltip>
        </div>
        {ratchetStatus === "ratchet_up" ? (
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-soft text-emerald border border-emerald-edge tabular-nums">
            ▲ +{simulatedOutcome.thresholdDelta > 0 ? simulatedOutcome.thresholdDelta : "2.3"} pts última sessão
          </span>
        ) : ratchetStatus === "plateau_held" ? (
          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-soft text-amber border border-amber-edge tabular-nums">
            Platô Protegido
          </span>
        ) : null}
      </div>

      {/* 2. Primary Metric Row */}
      <div className="flex items-baseline justify-between my-2">
        {hasData && dailyTarget !== null ? (
          <div className="flex items-baseline gap-1.5">
            <NumberTicker
              value={dailyTarget}
              className="text-3xl lg:text-[34px] font-mono font-bold tracking-tight text-emerald tabular-nums leading-none"
            />
            <span className="text-sm font-mono text-text-faint">pts</span>
          </div>
        ) : (
          <span className="text-3xl lg:text-[34px] font-mono font-bold text-text-faint">—</span>
        )}

        <div className="text-right">
          <span className="text-xs font-mono text-text-secondary block tabular-nums">
            Próximo degrau: {dailyTarget ? (dailyTarget * 1.02).toFixed(1) : "—"} pts
          </span>
        </div>
      </div>

      {/* 3. Baseline & Liquid Glass Progress Bar */}
      <div>
        <div className="flex justify-between items-center text-xs font-mono text-text-faint mb-1.5">
          <span>Piso histórico protegido (Nunca regride)</span>
          <span className="tabular-nums font-semibold text-emerald">{progressPct}% p/ subir degrau</span>
        </div>
        <BaseProgress.Root
          value={progressPct}
          className="w-full h-2 rounded-full bg-glass-input border border-glass-edge overflow-hidden shadow-inner"
        >
          <BaseProgress.Track className="w-full h-full bg-transparent">
            <BaseProgress.Indicator
              className="h-full bg-emerald rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </BaseProgress.Track>
        </BaseProgress.Root>
      </div>
    </SpotlightCard>
  );
}

export function TelemetryBentoPersonalBestCard({ className }: { className?: string }) {
  const { state } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { personalBest } = computedMetrics;

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);

  const pbSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    return activeTask.sessions.reduce((best, s) =>
      Number(s.pb) > Number(best.pb) ? s : best
    );
  }, [activeTask?.sessions]);

  const lastSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    const sorted = [...activeTask.sessions].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1];
  }, [activeTask?.sessions]);

  // Delta relative to most recent session
  const deltaPct = useMemo(() => {
    if (!personalBest || !lastSession) return null;
    const lastScore = Number(lastSession.pb) || 0;
    if (lastScore >= personalBest) return 0;
    const diff = ((lastScore - personalBest) / personalBest) * 100;
    return Number(diff.toFixed(1));
  }, [personalBest, lastSession]);

  return (
    <SpotlightCard
      style={{ "--i": 1 } as React.CSSProperties}
      className={cn(
        "enter lift p-6 flex flex-col justify-between min-h-[148px] liquid-glass-panel border-score/25",
        className
      )}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono font-semibold tracking-[0.08em] uppercase text-text-secondary">
          RECORDE PESSOAL (PB)
        </span>
        <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-score-soft text-score border border-score/30">
          NOVO PICO
        </span>
      </div>

      {/* 2. Primary Metric Row */}
      <div className="flex items-baseline justify-between my-2">
        {hasData && personalBest !== null ? (
          <div className="flex items-baseline gap-1.5">
            <NumberTicker
              value={personalBest}
              className="text-3xl lg:text-[34px] font-mono font-bold tracking-tight text-score tabular-nums leading-none"
            />
            <span className="text-sm font-mono text-text-faint">pts</span>
          </div>
        ) : (
          <span className="text-3xl lg:text-[34px] font-mono font-bold text-text-faint">—</span>
        )}

        <Sparkle size={18} weight="duotone" className="text-score opacity-80" />
      </div>

      {/* 3. Baseline */}
      <div className="text-xs font-mono text-text-faint flex items-center justify-between pt-1">
        <span>{pbSession?.date ? `Atingido em ${pbSession.date}` : "Sem histórico"}</span>
        <span className="text-score font-semibold tabular-nums">
          {deltaPct !== null && deltaPct < 0 ? `${deltaPct}% vs PB` : "+13.4% desde S1"}
        </span>
      </div>
    </SpotlightCard>
  );
}

export function TelemetryBentoConsistencyCard({ className }: { className?: string }) {
  const { state } = useTrackerWorkspace();
  const { activeTask, computedMetrics } = state;
  const { consistencyRatio, movingAverage3 } = computedMetrics;

  const hasData = Boolean(activeTask?.sessions && activeTask.sessions.length > 0);

  return (
    <SpotlightCard
      style={{ "--i": 2 } as React.CSSProperties}
      className={cn(
        "enter lift p-6 flex flex-col justify-between min-h-[148px] liquid-glass-panel",
        className
      )}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono font-semibold tracking-[0.08em] uppercase text-text-secondary">
          CONSISTÊNCIA (RATIO)
        </span>
        <span className="text-[11px] font-mono text-text-faint">Threshold / PB</span>
      </div>

      {/* 2. Primary Metric Row */}
      <div className="flex items-baseline justify-between my-2">
        {hasData && consistencyRatio !== null ? (
          <div className="flex items-baseline gap-1">
            <NumberTicker
              value={consistencyRatio}
              decimalPlaces={1}
              className="text-3xl lg:text-[34px] font-mono font-bold tracking-tight text-text-main tabular-nums leading-none"
            />
            <span className="text-sm font-mono text-text-faint">%</span>
          </div>
        ) : (
          <span className="text-3xl lg:text-[34px] font-mono font-bold text-text-faint">—</span>
        )}

        <Gauge size={18} weight="duotone" className="text-score opacity-80" />
      </div>

      {/* 3. Baseline */}
      <div className="text-xs font-mono text-text-faint flex items-center justify-between pt-1">
        <span>
          Média Móvel (3s):{" "}
          <strong className="text-text-secondary tabular-nums">
            {movingAverage3.length > 0 ? `${movingAverage3[movingAverage3.length - 1]} pts` : "—"}
          </strong>
        </span>
        <span className="text-emerald font-semibold">Alta Estabilidade</span>
      </div>
    </SpotlightCard>
  );
}

export function TelemetryBentoHardwareSetupCard({
  className,
  mouseDpi = 800,
}: {
  className?: string;
  mouseDpi?: number;
}) {
  const { state } = useTrackerWorkspace();
  const { activeTask } = state;

  const lastSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    const sorted = [...activeTask.sessions].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1];
  }, [activeTask?.sessions]);

  const sensDisplay = useMemo(() => {
    if (!lastSession?.sens) return "42.0";
    return formatSensitivity(lastSession.sens, mouseDpi, "");
  }, [lastSession?.sens, mouseDpi]);

  return (
    <SpotlightCard
      style={{ "--i": 3 } as React.CSSProperties}
      className={cn(
        "enter lift p-6 flex flex-col justify-between min-h-[148px] liquid-glass-panel",
        className
      )}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono font-semibold tracking-[0.08em] uppercase text-text-secondary">
          TELEMETRIA DE INPUT
        </span>
        <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-surface-subtle text-text-secondary border border-edge">
          CSV AUTO
        </span>
      </div>

      {/* 2. Primary Metric Row */}
      <div className="flex items-baseline justify-between my-2">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl lg:text-[34px] font-mono font-bold tracking-tight text-text-main tabular-nums leading-none">
            {sensDisplay}
          </span>
          <span className="text-xs font-mono text-text-faint">cm/360</span>
        </div>
        <Crosshair size={18} weight="bold" className="text-text-faint" />
      </div>

      {/* 3. Baseline */}
      <div className="text-xs font-mono text-text-faint flex items-center justify-between pt-1">
        <span>FOV: 103 OW</span>
        <span className="text-text-secondary tabular-nums">{mouseDpi} DPI • 0.205</span>
      </div>
    </SpotlightCard>
  );
}

/**
 * TelemetryBento: 4-column Bento row with strict 24px spatial grid rhythm.
 * Column spans: Card 1 = 4 cols, Card 2 = 3 cols, Card 3 = 3 cols, Card 4 = 2 cols.
 */
export function TelemetryBento({ className, mouseDpi = 800 }: TelemetryBentoProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-5 lg:gap-6",
        className
      )}
    >
      <TelemetryBentoTargetCard className="col-span-12 lg:col-span-4" />
      <TelemetryBentoPersonalBestCard className="col-span-12 sm:col-span-4 lg:col-span-3" />
      <TelemetryBentoConsistencyCard className="col-span-12 sm:col-span-4 lg:col-span-3" />
      <TelemetryBentoHardwareSetupCard className="col-span-12 sm:col-span-4 lg:col-span-2" mouseDpi={mouseDpi} />
    </div>
  );
}

// Compound component attachments
TelemetryBento.TargetCard = TelemetryBentoTargetCard;
TelemetryBento.PersonalBestCard = TelemetryBentoPersonalBestCard;
TelemetryBento.ConsistencyCard = TelemetryBentoConsistencyCard;
TelemetryBento.HardwareSetupCard = TelemetryBentoHardwareSetupCard;
