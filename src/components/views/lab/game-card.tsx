import { useI18n, type Key } from "@/lib/i18n";
import { GAMES, cmToGame, formatGameSens, type GameDef } from "@/lib/lab/games";
import type { GameSuggestion, VerdictKind } from "@/lib/lab/game-suggestion";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

export interface GameCardProps {
  game: GameDef;
  dpi: number;
  suggestion: GameSuggestion;
  /** Frase direcional já traduzida. */
  phrase: string;
  /** Sens atual no jogo informada pelo usuário (texto do campo). */
  sensDraft: string;
  /** cm/360 correspondente à sens atual, ou null se vazia/inválida. */
  currentCm: number | null;
  verdictKind: VerdictKind | null;
  onGameChange: (gameId: string) => void;
  onSensDraftChange: (value: string) => void;
  onSensSave: () => void;
  className?: string;
}

const VERDICT_VARIANT: Record<VerdictKind, BadgeVariant> = {
  inside: "emerald",
  faster_than_range: "amber",
  slower_than_range: "amber",
};

const VERDICT_KEY: Record<VerdictKind, Key> = {
  inside: "lab.verdict.inside",
  faster_than_range: "lab.verdict.faster",
  slower_than_range: "lab.verdict.slower",
};

export function GameCard({
  game,
  dpi,
  suggestion,
  phrase,
  sensDraft,
  currentCm,
  verdictKind,
  onGameChange,
  onSensDraftChange,
  onSensSave,
  className,
}: GameCardProps) {
  const { t } = useI18n();

  const ok = suggestion.status === "ok";
  const bandCm = ok ? `${suggestion.loCm.toFixed(1)}–${suggestion.hiCm.toFixed(1)}` : null;
  let bandGame: string | null = null;
  if (ok) {
    const a = cmToGame(suggestion.hiCm, dpi, game);
    const b = cmToGame(suggestion.loCm, dpi, game);
    bandGame = `${formatGameSens(Math.min(a, b), game)}–${formatGameSens(Math.max(a, b), game)}`;
  }

  const coverage = Math.min(1, suggestion.totalWeight);
  const total = suggestion.contributions.reduce((s, c) => s + c.effectiveWeight, 0);

  return (
    <section className={cn("liquid-surface p-5 rounded-tile space-y-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex-1 min-w-0 space-y-1">
          <span className="text-[11px] font-semibold text-text-faint uppercase tracking-wider">
            {t("lab.game.label")}
          </span>
          <Select value={game.id} onChange={(e) => onGameChange(e.target.value)} className="w-full">
            {GAMES.map((g) => (
              <option key={g.id} value={g.id} className="bg-surface text-text-main">
                {g.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex-1 min-w-0 space-y-1">
          <span className="text-[11px] font-semibold text-text-faint uppercase tracking-wider">
            {t("lab.game.sensLabel")}
          </span>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={sensDraft}
              onChange={(e) => onSensDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSensSave();
              }}
              onBlur={onSensSave}
              placeholder={game.decimals > 0 ? (0.35).toFixed(game.decimals) : "1"}
              className="w-full font-mono"
              aria-label={t("lab.game.sensLabel")}
            />
            <Button variant="secondary" size="sm" onClick={onSensSave} className="rounded-full shrink-0">
              {t("lab.game.save")}
            </Button>
          </div>
        </label>
      </div>

      <p className="text-[11px] text-text-faint">
        {t("lab.conversionNote")}
      </p>

      {ok ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="liquid-well rounded-control p-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wider">
              {t("lab.game.rangeCm")}
            </div>
            <div className="font-mono font-bold text-score tabular text-base mt-1">{bandCm} cm</div>
          </div>
          <div className="liquid-well rounded-control p-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wider">
              {t("lab.game.rangeGame", { game: game.name })}
            </div>
            <div className="font-mono font-bold text-emerald tabular text-base mt-1">{bandGame}</div>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-text-secondary leading-relaxed">{phrase}</p>

      <div className="flex flex-wrap items-center gap-2">
        {currentCm === null ? (
          <span className="text-[11px] text-text-faint">{t("lab.game.noSens")}</span>
        ) : verdictKind ? (
          <Badge variant={VERDICT_VARIANT[verdictKind]}>{t(VERDICT_KEY[verdictKind])}</Badge>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-text-faint">
          <span className="uppercase tracking-wider font-semibold">{t("lab.game.coverage")}</span>
          <span className="font-mono tabular">{Math.round(coverage * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-edge overflow-hidden">
          <div className="h-full bg-score rounded-full" style={{ width: `${coverage * 100}%` }} />
        </div>
      </div>

      {ok && total > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-text-faint uppercase tracking-wider">
            {t("lab.game.contributions")}
          </div>
          {suggestion.contributions.map((c) => (
            <div key={`${c.category}/${c.subcategory}`} className="space-y-0.5">
              <div className="flex justify-between text-[11px] text-text-secondary">
                <span className="truncate">
                  {c.category} · {c.subcategory}
                </span>
                <span className="font-mono tabular">{Math.round((c.effectiveWeight / total) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-edge overflow-hidden">
                <div
                  className="h-full bg-emerald rounded-full"
                  style={{ width: `${(c.effectiveWeight / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-text-faint">{t("lab.weights.initialEstimate")}</p>
        </div>
      ) : null}
    </section>
  );
}
