import { useI18n } from "@/lib/i18n";
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
      <div className="glass-inset p-3 rounded-control flex flex-col justify-center space-y-1">
        <span className="text-[11px] text-text-faint font-medium">
          {t("randomizer.inGameEquivalent")} ({parsedDpi} DPI)
        </span>
        <div className="flex items-center gap-3 text-xs font-mono tabular">
          <div>
            <span className="text-text-faint mr-1">Val:</span>
            <span className="font-semibold text-text-main">{inGameValorant}</span>
          </div>
          <div>
            <span className="text-text-faint mr-1">Source:</span>
            <span className="font-semibold text-text-main">{inGameSource}</span>
          </div>
        </div>
      </div>

      {/* Spread % and Mouse DPI presets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary">{t("randomizer.spreadPercent")}</span>
            <span className="font-mono text-text-faint tabular">±{spreadPercent}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            {SPREAD_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSelectSpread(p)}
                className={cn(
                  "flex-1 py-1 px-2 rounded-control text-xs font-mono tabular transition-all cursor-pointer press",
                  spreadPercent === p
                    ? "glass-control text-text-main font-bold border border-edge-strong shadow-1"
                    : "text-text-faint hover:text-text-main"
                )}
              >
                ±{p}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-secondary">{t("randomizer.mouseDpi")}</span>
            <span className="font-mono text-text-faint tabular">{mouseDpi}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {DPI_PRESETS.map((dpi) => (
              <button
                key={dpi}
                type="button"
                onClick={() => onSelectDpi(dpi)}
                className={cn(
                  "flex-1 py-1 px-2 rounded-control text-xs font-mono tabular transition-all cursor-pointer press",
                  String(dpi) === mouseDpi
                    ? "glass-control text-text-main font-bold border border-edge-strong shadow-1"
                    : "text-text-faint hover:text-text-main"
                )}
              >
                {dpi}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
