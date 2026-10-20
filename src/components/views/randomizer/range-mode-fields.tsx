import { useI18n } from "@/lib/i18n";
import { Segmented } from "@/components/ui/Segmented";
import { Field, Input } from "@/components/ui/Field";

export interface RangeModeFieldsProps {
  rangeMode: "cm360" | "multiplier";
  onChangeRangeMode: (mode: "cm360" | "multiplier") => void;
  minCm: string;
  onChangeMinCm: (val: string) => void;
  maxCm: string;
  onChangeMaxCm: (val: string) => void;
  minMult: string;
  onChangeMinMult: (val: string) => void;
  maxMult: string;
  onChangeMaxMult: (val: string) => void;
  baseSens: string;
  onChangeBaseSens: (val: string) => void;
  getFieldError: (field: string) => string | null;
}

export function RangeModeFields({
  rangeMode,
  onChangeRangeMode,
  minCm,
  onChangeMinCm,
  maxCm,
  onChangeMaxCm,
  minMult,
  onChangeMinMult,
  maxMult,
  onChangeMaxMult,
  baseSens,
  onChangeBaseSens,
  getFieldError,
}: RangeModeFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary">
          {t("randomizer.mode")}
        </span>
        <Segmented
          options={[
            { value: "cm360", label: t("randomizer.modeCm") },
            { value: "multiplier", label: t("randomizer.modeMult") },
          ]}
          value={rangeMode}
          onChange={(val) => onChangeRangeMode(val as "cm360" | "multiplier")}
          size="sm"
        />
      </div>

      {rangeMode === "cm360" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("randomizer.min") + " (cm/360)"} error={getFieldError("minCm")}>
            <Input
              type="number"
              step="0.1"
              value={minCm}
              onChange={(e) => onChangeMinCm(e.target.value)}
              invalid={Boolean(getFieldError("minCm"))}
            />
          </Field>
          <Field label={t("randomizer.max") + " (cm/360)"} error={getFieldError("maxCm")}>
            <Input
              type="number"
              step="0.1"
              value={maxCm}
              onChange={(e) => onChangeMaxCm(e.target.value)}
              invalid={Boolean(getFieldError("maxCm"))}
            />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("randomizer.min") + " (x)"} error={getFieldError("minMult")}>
            <Input
              type="number"
              step="0.05"
              value={minMult}
              onChange={(e) => onChangeMinMult(e.target.value)}
              invalid={Boolean(getFieldError("minMult"))}
            />
          </Field>
          <Field label={t("randomizer.max") + " (x)"} error={getFieldError("maxMult")}>
            <Input
              type="number"
              step="0.05"
              value={maxMult}
              onChange={(e) => onChangeMaxMult(e.target.value)}
              invalid={Boolean(getFieldError("maxMult"))}
            />
          </Field>
        </div>
      )}

      {/* Base Sens */}
      <Field
        label={t("randomizer.baseSens")}
        description={t("randomizer.baseSensHelp")}
        error={getFieldError("baseSens")}
      >
        <Input
          type="number"
          step="0.5"
          value={baseSens}
          onChange={(e) => onChangeBaseSens(e.target.value)}
          invalid={Boolean(getFieldError("baseSens"))}
        />
      </Field>
    </div>
  );
}
