import { useI18n } from "@/lib/i18n";
import { Switch } from "@/components/ui/Switch";

export interface CategoryGatesProps {
  categories: string[];
  /** Ausente = habilitada. */
  categoryEnabled: Record<string, boolean>;
  onToggleCategory: (category: string, enabled: boolean) => void;
}

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json.

export function CategoryGates({ categories, categoryEnabled, onToggleCategory }: CategoryGatesProps) {
  const { t } = useI18n();

  return (
    <div className="liquid-well p-3 rounded-control space-y-2.5">
      <span className="text-xs font-semibold text-text-main block">
        {t("randomizer.gatesTitle")}
      </span>

      <div className="space-y-1.5">
        {categories.map((category) => {
          const enabled = categoryEnabled[category] !== false;
          return (
            <div
              key={category}
              className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-control border border-edge"
            >
              <span className="text-xs font-medium text-text-secondary">{category}</span>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => onToggleCategory(category, checked)}
                aria-label={category}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-faint leading-snug">{t("randomizer.gatesTip")}</p>
    </div>
  );
}
