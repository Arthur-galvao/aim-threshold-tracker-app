import { useI18n, type Key } from "@/lib/i18n";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import {
  defaultDirection,
  directionKey,
  resolveDirection,
} from "@/lib/randomizer-directions";
import type { RandomizerDirection } from "@/hooks/useSensRandomizer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DirectionTableProps {
  directionOverrides: Record<string, RandomizerDirection>;
  onChangeDirection: (category: string, subcategory: string, direction: RandomizerDirection) => void;
  onRestoreDefaults: () => void;
}

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json.

const DIRECTION_COLUMNS: Array<{ value: RandomizerDirection; labelKey: Key }> = [
  { value: "fast", labelKey: "randomizer.directionFast" },
  { value: "neutral", labelKey: "randomizer.directionNeutral" },
  { value: "slow", labelKey: "randomizer.directionSlow" },
];

export function DirectionTable({
  directionOverrides,
  onChangeDirection,
  onRestoreDefaults,
}: DirectionTableProps) {
  const { t } = useI18n();
  const hasOverrides = Object.keys(directionOverrides).length > 0;

  return (
    <div className="liquid-well p-3 rounded-control space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-main">
          {t("randomizer.directionsTitle")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasOverrides}
          onClick={onRestoreDefaults}
          className="rounded-full"
        >
          {t("randomizer.directionRestore")}
        </Button>
      </div>
      <p className="text-[11px] text-text-faint leading-snug">{t("randomizer.directionsSource")}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-y-1">
          <thead>
            <tr className="text-[11px] text-text-faint">
              <th className="text-left font-medium pb-1 pr-2">{t("randomizer.directionSubcategory")}</th>
              {DIRECTION_COLUMNS.map((col) => (
                <th key={col.value} className="font-medium pb-1 px-1 text-center">
                  {t(col.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(VISCOSE_CATEGORIES).map(([category, subcategories]) => (
              <CategoryRows
                key={category}
                category={category}
                subcategories={subcategories}
                directionOverrides={directionOverrides}
                onChangeDirection={onChangeDirection}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CategoryRowsProps {
  category: string;
  subcategories: string[];
  directionOverrides: Record<string, RandomizerDirection>;
  onChangeDirection: (category: string, subcategory: string, direction: RandomizerDirection) => void;
}

function CategoryRows({ category, subcategories, directionOverrides, onChangeDirection }: CategoryRowsProps) {
  const { t } = useI18n();
  return (
    <>
      <tr>
        <td colSpan={4} className="pt-2 pb-0.5 text-[11px] font-semibold text-text-secondary">
          {category}
        </td>
      </tr>
      {subcategories.map((sub) => {
        const current = resolveDirection(directionOverrides, category, sub);
        const isOverridden = directionKey(category, sub) in directionOverrides
          && directionOverrides[directionKey(category, sub)] !== defaultDirection(category, sub);
        return (
          <tr key={sub}>
            <th className="text-left font-mono font-medium text-text-main pr-2 py-0.5">
              <span className="flex items-center gap-1.5">
                {sub}
                {isOverridden && <span className="w-1.5 h-1.5 rounded-full bg-amber" />}
              </span>
            </th>
            {DIRECTION_COLUMNS.map((col) => {
              const active = current === col.value;
              return (
                <td key={col.value} className="px-1 py-0.5">
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${sub}: ${t(col.labelKey)}`}
                    onClick={() => onChangeDirection(category, sub, col.value)}
                    className={cn(
                      "w-full h-7 rounded-control border text-[11px] transition-all duration-150 cursor-pointer active:scale-[0.96]",
                      active
                        ? "bg-score-soft border-score-edge text-text-main font-bold shadow-1"
                        : "liquid-well border-edge text-text-faint hover:text-text-main hover:border-edge-strong"
                    )}
                  >
                    {/* Marca a sugestão padrão da Viscose */}
                    {defaultDirection(category, sub) === col.value ? "•" : ""}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
