import { useI18n } from "@/lib/i18n";
import { Switch } from "@/components/ui/Switch";

export interface RangeTogglesProps {
  autoScenarioSens: boolean;
  onToggleAutoScenario: (checked: boolean) => void;
  avoidRepeats: boolean;
  onToggleAvoidRepeats: (checked: boolean) => void;
  idealSensSummary?: string | null;
  minCm: number;
  maxCm: number;
  gridPointsCount: number;
}

export function RangeToggles({
  autoScenarioSens,
  onToggleAutoScenario,
  avoidRepeats,
  onToggleAvoidRepeats,
  idealSensSummary,
  minCm,
  maxCm,
  gridPointsCount,
}: RangeTogglesProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="space-y-2 pt-2 border-t border-edge">
        <div className="flex items-center justify-between p-2.5 rounded-control glass-control">
          <div>
            <span className="text-xs font-semibold text-text-main block">
              {t("randomizer.autoScenarioSens")}
            </span>
            <span className="text-[11px] text-text-faint block">
              {idealSensSummary || t("randomizer.autoScenarioSensDesc")}
            </span>
          </div>
          <Switch
            checked={autoScenarioSens}
            onCheckedChange={onToggleAutoScenario}
          />
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-control glass-control">
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
      <div className="glass-inset p-3 rounded-control text-xs flex items-center justify-between font-mono tabular text-text-faint">
        <span>{t("randomizer.spreadCalculatedRange")}</span>
        <span className="text-text-main font-semibold">
          {minCm.toFixed(1)} - {maxCm.toFixed(1)} cm
          {gridPointsCount > 0 && ` (${gridPointsCount} pts)`}
        </span>
      </div>
    </div>
  );
}
