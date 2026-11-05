import { useMemo, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { useI18n, type Key } from "@/lib/i18n";
import type { CategoryRange, RangeConfidence } from "@/lib/lab/category-range";
import { cmToGame, formatGameSens, type GameDef } from "@/lib/lab/games";
import { buildRunPoints } from "@/lib/run-points";
import type { RunDataPoint } from "@/lib/sens-analytics";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SweetSpotChart } from "@/components/views/randomizer/sweet-spot-chart";
import { cn } from "@/lib/utils";


export interface CategoryRangeCardProps {
  range: CategoryRange;
  /** Tasks só desta subcategoria (para o mini-gráfico, montado só quando aberto). */
  subTasks: Task[];
  game: GameDef;
  dpi: number;
  className?: string;
}

const CONFIDENCE_VARIANT: Record<RangeConfidence, BadgeVariant> = {
  high: "emerald",
  medium: "score",
  low: "amber",
  insufficient: "neutral",
};

const CONFIDENCE_KEY: Record<RangeConfidence, Key> = {
  high: "randomizer.confidenceHigh",
  medium: "randomizer.confidenceMedium",
  low: "randomizer.confidenceLow",
  insufficient: "randomizer.confInsufficient",
};

export function CategoryRangeCard({
  range,
  subTasks,
  game,
  dpi,
  className,
}: CategoryRangeCardProps) {
  const { t } = useI18n();
  const [chartOpen, setChartOpen] = useState(false);

  const hasBand = range.loCm !== null && range.hiCm !== null;
  const gameBand = useMemo(() => {
    if (range.loCm === null || range.hiCm === null) return null;
    const a = cmToGame(range.hiCm, dpi, game);
    const b = cmToGame(range.loCm, dpi, game);
    return `${formatGameSens(Math.min(a, b), game)}–${formatGameSens(Math.max(a, b), game)}`;
  }, [range.loCm, range.hiCm, dpi, game]);

  // Mini-gráfico: rel × sens (sem a curva do preditor antigo), só quando aberto.
  const chartRuns = useMemo<RunDataPoint[]>(() => {
    if (!chartOpen) return [];
    return buildRunPoints(subTasks, { dpi }).map((p) => ({
      scenario: p.scenario,
      sens: p.sens,
      rawScore: p.score,
      normScore: p.rel,
      score: p.rel,
      threshold: p.threshold,
      date: p.date,
    }));
  }, [chartOpen, subTasks, dpi]);

  const flat = range.confidence !== "insufficient" && range.centerCm === null;
  const noData = range.confidence === "insufficient";

  return (
    <article className={cn("liquid-surface p-4 rounded-tile space-y-3", className)}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-text-main truncate">
            {range.category}
          </h3>
          <p className="text-[11px] text-text-faint truncate">{range.subcategory}</p>
        </div>
        <Badge variant={CONFIDENCE_VARIANT[range.confidence]}>
          {t(CONFIDENCE_KEY[range.confidence])}
        </Badge>
      </header>

      {hasBand && (
        <div className="space-y-0.5">
          <div className="font-mono font-bold text-score tabular text-sm">
            {range.loCm!.toFixed(1)}–{range.hiCm!.toFixed(1)} cm/360
          </div>
          <div className="font-mono text-[11px] text-text-secondary tabular">
            {t("lab.range.bandGame", { band: gameBand ?? "", game: game.name })}
          </div>
        </div>
      )}

      {noData && <p className="text-[11px] text-text-faint">{t("lab.range.insufficient")}</p>}
      {flat && <p className="text-[11px] text-text-faint">{t("lab.range.flat")}</p>}
      {range.centerCm !== null && (
        <p className="text-[11px] text-text-secondary">
          {t("lab.range.center", { cm: range.centerCm.toFixed(1) })}
        </p>
      )}

      {(range.slowPenaltyPct !== null || range.fastPenaltyPct !== null) && (
        <ul className="space-y-0.5 text-[11px] text-text-secondary">
          {range.slowPenaltyPct !== null && (
            <li>{t("lab.range.penaltySlow", { pct: Math.round(range.slowPenaltyPct) })}</li>
          )}
          {range.fastPenaltyPct !== null && (
            <li>{t("lab.range.penaltyFast", { pct: Math.round(range.fastPenaltyPct) })}</li>
          )}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-text-faint tabular">
          {t("lab.range.stats", { runs: range.nRuns, sens: range.nSens })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChartOpen((v) => !v)}
          icon={chartOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
          className="rounded-full"
          aria-expanded={chartOpen}
        >
          {chartOpen ? t("lab.range.hideChart") : t("lab.range.showChart")}
        </Button>
      </div>

      {chartOpen && (
        <SweetSpotChart
          relevantSessions={chartRuns}
          scopeFilter={{ mode: "category", categoryKey: `${range.category}__${range.subcategory}` }}
          scopeTitle={`${range.category} · ${range.subcategory}`}
          activeMinCm={range.loCm ?? undefined}
          activeMaxCm={range.hiCm ?? undefined}
          prediction={null}
        />
      )}
    </article>
  );
}
