import { useI18n, type Key } from "@/lib/i18n";
import { NumberTicker } from "@/components/ui/NumberTicker";
import type { RandomizerMode } from "@/hooks/useSensRandomizer";
import { cn } from "@/lib/utils";

export interface RandomizerPreset {
  id: string;
  mode: RandomizerMode;
  spreadPercent: number;
  alternatingBlock?: number;
  titleKey: Key;
  descKey: Key;
}

/** Presets nomeados do Plano 05 (T5.7d). Aplicam ao rascunho; o usuário salva. */
export const RANDOMIZER_PRESETS: RandomizerPreset[] = [
  {
    id: "viscose-directed",
    mode: "directed",
    spreadPercent: 25,
    titleKey: "randomizer.presetDirected",
    descKey: "randomizer.presetDirectedDesc",
  },
  {
    id: "muscle-rotation",
    mode: "alternating",
    spreadPercent: 25,
    alternatingBlock: 3,
    titleKey: "randomizer.presetAlternating",
    descKey: "randomizer.presetAlternatingDesc",
  },
  {
    id: "tracking-exploration",
    mode: "explore",
    spreadPercent: 40,
    titleKey: "randomizer.presetExplore",
    descKey: "randomizer.presetExploreDesc",
  },
  {
    id: "light",
    mode: "center",
    spreadPercent: 12,
    titleKey: "randomizer.presetLight",
    descKey: "randomizer.presetLightDesc",
  },
];

export interface RangePresetsProps {
  mode: RandomizerMode;
  onApplyPreset: (preset: RandomizerPreset) => void;
  spreadPercent: number;
  onSelectSpread: (percent: number) => void;
  mouseDpi: string;
  onSelectDpi: (dpi: number) => void;
  inGameValorant: number;
  inGameSource: number;
  parsedDpi: number;
  minCm?: number;
  maxCm?: number;
}

const SPREAD_PRESETS = [10, 15, 20, 25, 30, 40];
const DPI_PRESETS = [400, 800, 1600, 3200];

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json.

function isPresetActive(preset: RandomizerPreset, mode: RandomizerMode, spreadPercent: number): boolean {
  return preset.mode === mode && preset.spreadPercent === spreadPercent;
}

export function RangePresets({
  mode,
  onApplyPreset,
  spreadPercent,
  onSelectSpread,
  mouseDpi,
  onSelectDpi,
  inGameValorant,
  inGameSource,
  parsedDpi,
  minCm,
  maxCm,
}: RangePresetsProps) {
  const { t } = useI18n();

  const zoneLabel =
    spreadPercent <= 12
      ? t("randomizer.zoneFine")
      : spreadPercent <= 22
        ? t("randomizer.zoneContextual")
        : t("randomizer.zoneEnvelope");

  const isOutsideBiomechEnvelope =
    (minCm !== undefined && minCm > 0 && minCm < 20) ||
    (maxCm !== undefined && maxCm > 80);

  return (
    <div className="space-y-3">
      {/* Named presets (T5.7d) */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-text-secondary">
          {t("randomizer.presetsTitle")}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {RANDOMIZER_PRESETS.map((preset) => {
            const active = isPresetActive(preset, mode, spreadPercent);
            const description = t(preset.descKey);
            return (
              <button
                key={preset.id}
                type="button"
                title={description}
                aria-pressed={active}
                onClick={() => onApplyPreset(preset)}
                className={cn(
                  "text-left py-1.5 px-2.5 rounded-control border text-xs transition-all duration-150 cursor-pointer hover:-translate-y-[1px] active:scale-[0.96] active:translate-y-0",
                  active
                    ? "bg-score-soft border-score-edge text-text-main font-bold shadow-1"
                    : "liquid-well border-edge text-text-faint hover:text-text-main hover:border-edge-strong"
                )}
              >
                <span className="block">{t(preset.titleKey)}</span>
                <span className="block text-[11px] text-text-faint font-normal leading-snug">
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* In-Game Previews & Biomechanical Regime */}
      <div className="liquid-well p-3 rounded-control flex flex-col justify-center space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-faint font-medium">
            {t("randomizer.inGameEquivalent")} ({parsedDpi} DPI)
          </span>
          <span
            className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded border",
              isOutsideBiomechEnvelope
                ? "text-amber bg-amber/10 border-amber/30"
                : "text-score bg-score-soft border-score-edge"
            )}
          >
            {isOutsideBiomechEnvelope ? t("randomizer.zoneOutWarning") : zoneLabel}
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-4 text-xs font-mono tabular">
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-faint">{t("randomizer.inGameValLabel")}</span>
            <NumberTicker
              value={inGameValorant}
              decimalPlaces={3}
              className="font-semibold text-text-main"
            />
          </div>
          <div className="h-3 w-[1px] bg-edge" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-faint">{t("randomizer.inGameEdpiLabel")}</span>
            <NumberTicker
              value={Math.round(inGameValorant * parsedDpi)}
              decimalPlaces={0}
              className="font-semibold text-text-main"
            />
          </div>
          <div className="h-3 w-[1px] bg-edge" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-faint">{t("randomizer.inGameSourceLabel")}</span>
            <NumberTicker
              value={inGameSource}
              decimalPlaces={2}
              className="font-semibold text-text-main"
            />
          </div>
        </div>
      </div>

      {/* Spread % and Mouse DPI presets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary">
              {t("randomizer.spreadPercent")}
            </span>
            <span className="font-mono text-score font-semibold tabular">
              ±{spreadPercent}%
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {SPREAD_PRESETS.map((p) => {
              const active = spreadPercent === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelectSpread(p)}
                  className={cn(
                    "py-1.5 px-1 rounded-control text-xs font-mono tabular transition-all duration-150 cursor-pointer border hover:-translate-y-[1px] active:scale-[0.96] active:translate-y-0",
                    active
                      ? "bg-score-soft border-score-edge text-text-main font-bold shadow-1"
                      : "liquid-well border-edge text-text-faint hover:text-text-main hover:border-edge-strong"
                  )}
                >
                  ±{p}%
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary">
              {t("randomizer.mouseDpi")}
            </span>
            <span className="font-mono text-score font-semibold tabular">
              {mouseDpi}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {DPI_PRESETS.map((dpi) => {
              const active = String(dpi) === mouseDpi;
              return (
                <button
                  key={dpi}
                  type="button"
                  onClick={() => onSelectDpi(dpi)}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-control text-xs font-mono tabular transition-all duration-150 cursor-pointer border hover:-translate-y-[1px] active:scale-[0.96] active:translate-y-0",
                    active
                      ? "bg-score-soft border-score-edge text-text-main font-bold shadow-1"
                      : "liquid-well border-edge text-text-faint hover:text-text-main hover:border-edge-strong"
                  )}
                >
                  {dpi}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
