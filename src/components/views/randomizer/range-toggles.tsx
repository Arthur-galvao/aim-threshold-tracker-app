import { useI18n, type Key } from "@/lib/i18n";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Switch } from "@/components/ui/Switch";
import type { RandomizerCenterSource } from "@/hooks/useSensRandomizer";
import { cn } from "@/lib/utils";

export interface RangeTogglesProps {
  centerSource: RandomizerCenterSource;
  onChangeCenterSource: (source: RandomizerCenterSource) => void;
  avoidRepeats: boolean;
  onToggleAvoidRepeats: (checked: boolean) => void;
  idealSensSummary?: string | null;
  minCm: number;
  maxCm: number;
  gridPointsCount: number;
}

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json.

const CENTER_OPTIONS: Array<{
  value: RandomizerCenterSource;
  titleKey: Key;
  descKey: Key;
  experimental?: boolean;
}> = [
  { value: "personal_relative", titleKey: "randomizer.centerPersonal", descKey: "randomizer.centerPersonalDesc" },
  { value: "viscose_absolute", titleKey: "randomizer.centerViscose", descKey: "randomizer.centerViscoseDesc" },
  { value: "base", titleKey: "randomizer.centerBase", descKey: "randomizer.centerBaseDesc" },
  { value: "lab", titleKey: "randomizer.centerLab", descKey: "randomizer.centerLabDesc", experimental: true },
];

export function RangeToggles({
  centerSource,
  onChangeCenterSource,
  avoidRepeats,
  onToggleAvoidRepeats,
  idealSensSummary,
  minCm,
  maxCm,
  gridPointsCount,
}: RangeTogglesProps) {
  const { t } = useI18n();
  const selected = CENTER_OPTIONS.find((o) => o.value === centerSource) ?? CENTER_OPTIONS[0];

  return (
    <div className="space-y-3">
      <div className="space-y-2 pt-2 border-t border-edge">
        {/* Fonte do centro (Plano 05, T5.7a) */}
        <div className="p-2.5 rounded-control liquid-well space-y-2">
          <span className="text-xs font-semibold text-text-main block">
            {t("randomizer.centerSourceTitle")}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {CENTER_OPTIONS.map((opt) => {
              const active = centerSource === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeCenterSource(opt.value)}
                  className={cn(
                    "py-1.5 px-2 rounded-control text-xs border transition-all duration-150 cursor-pointer hover:-translate-y-[1px] active:scale-[0.96] active:translate-y-0 flex items-center justify-center gap-1.5",
                    active
                      ? "bg-score-soft border-score-edge text-text-main font-bold shadow-1"
                      : "liquid-well border-edge text-text-faint hover:text-text-main hover:border-edge-strong"
                  )}
                >
                  <span>{t(opt.titleKey)}</span>
                  {opt.experimental && (
                    <span className="text-[9px] uppercase tracking-wide text-amber font-semibold">
                      {t("randomizer.experimentalTag")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-text-faint block">
            {t(selected.descKey)}
            {centerSource !== "base" && idealSensSummary ? ` · ${idealSensSummary}` : ""}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-control liquid-well hover:border-edge-strong transition-colors">
          <span className="text-xs font-semibold text-text-main">
            {t("randomizer.avoidRepeats")}
          </span>
          <Switch
            checked={avoidRepeats}
            onCheckedChange={onToggleAvoidRepeats}
          />
        </div>
      </div>

      {/* Range preview info */}
      <div className="liquid-well p-3 rounded-control text-xs flex items-center justify-between font-mono tabular text-text-faint">
        <span>{t("randomizer.spreadCalculatedRange")}</span>
        <span className="text-text-main font-semibold flex items-baseline gap-1">
          <NumberTicker value={minCm} decimalPlaces={1} />
          <span>-</span>
          <NumberTicker value={maxCm} decimalPlaces={1} suffix=" cm" />
          {gridPointsCount > 0 && (
            <span className="text-text-faint ml-1">({gridPointsCount} pts)</span>
          )}
        </span>
      </div>
    </div>
  );
}
