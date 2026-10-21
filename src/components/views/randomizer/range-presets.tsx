import { useI18n } from "@/lib/i18n";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { cn } from "@/lib/utils";

export interface RangePresetsProps {
  spreadPercent: number;
  onSelectSpread: (percent: number) => void;
  mouseDpi: string;
  onSelectDpi: (dpi: number) => void;
  inGameValorant: number;
  inGameSource: number;
  parsedDpi: number;
}

const SPREAD_PRESETS = [15, 20, 25, 30];
const DPI_PRESETS = [400, 800, 1600, 3200];

export function RangePresets({
  spreadPercent,
  onSelectSpread,
  mouseDpi,
  onSelectDpi,
  inGameValorant,
  inGameSource,
  parsedDpi,
}: RangePresetsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {/* In-Game Previews */}
      <div className="liquid-well p-3 rounded-control flex flex-col justify-center space-y-1.5">
        <span className="text-[11px] text-text-faint font-medium">
          {t("randomizer.inGameEquivalent")} ({parsedDpi} DPI)
        </span>
        <div className="flex items-center gap-4 text-xs font-mono tabular">
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-faint">Val:</span>
            <NumberTicker
              value={inGameValorant}
              decimalPlaces={3}
              className="font-semibold text-text-main"
            />
          </div>
          <div className="h-3 w-[1px] bg-edge" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-faint">Source:</span>
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
          <div className="flex items-center gap-1.5">
            {SPREAD_PRESETS.map((p) => {
              const active = spreadPercent === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelectSpread(p)}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-control text-xs font-mono tabular transition-all duration-150 cursor-pointer border hover:-translate-y-[1px] active:scale-[0.96] active:translate-y-0",
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
