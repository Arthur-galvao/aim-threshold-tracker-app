import { useI18n, type Key } from "@/lib/i18n";
import { Segmented } from "@/components/ui/Segmented";
import { Field, Input } from "@/components/ui/Field";
import type { RandomizerMode } from "@/hooks/useSensRandomizer";
import { cn } from "@/lib/utils";

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
  mode: RandomizerMode;
  onChangeMode: (mode: RandomizerMode) => void;
  reactivationRuns: string;
  onChangeReactivationRuns: (val: string) => void;
  anchorEvery: string;
  onChangeAnchorEvery: (val: string) => void;
  alternatingBlock: string;
  onChangeAlternatingBlock: (val: string) => void;
}

// Textos novos do Plano 05 (T5.7) ficam em docs/plans/i18n-pending/T5.7.json
// até o T5.8 integrar em i18n.tsx. Cast local evita erro de tipo nas chaves pendentes.

const MODE_OPTIONS: Array<{ value: RandomizerMode; titleKey: Key; descKey: Key }> = [
  { value: "center", titleKey: "randomizer.modeCenterTitle", descKey: "randomizer.modeCenterDesc" },
  { value: "directed", titleKey: "randomizer.modeDirectedTitle", descKey: "randomizer.modeDirectedDesc" },
  { value: "alternating", titleKey: "randomizer.modeAlternatingTitle", descKey: "randomizer.modeAlternatingDesc" },
  { value: "explore", titleKey: "randomizer.modeExploreTitle", descKey: "randomizer.modeExploreDesc" },
];

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
  mode,
  onChangeMode,
  reactivationRuns,
  onChangeReactivationRuns,
  anchorEvery,
  onChangeAnchorEvery,
  alternatingBlock,
  onChangeAlternatingBlock,
}: RangeModeFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Estratégia de variação (Plano 05, T5.7a) */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-text-secondary">
          {t("randomizer.strategyTitle")}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeMode(opt.value)}
                className={cn(
                  "text-left p-2.5 rounded-control border transition-all duration-150 cursor-pointer hover:-translate-y-[1px] active:scale-[0.98] active:translate-y-0",
                  active
                    ? "bg-score-soft border-score-edge shadow-1"
                    : "liquid-well border-edge hover:border-edge-strong"
                )}
              >
                <span
                  className={cn(
                    "block text-xs font-semibold",
                    active ? "text-text-main" : "text-text-secondary"
                  )}
                >
                  {t(opt.titleKey)}
                </span>
                <span className="block text-[11px] text-text-faint leading-snug mt-0.5">
                  {t(opt.descKey)}
                </span>
              </button>
            );
          })}
        </div>
        {mode === "explore" && (
          <p className="text-[11px] text-text-faint">{t("randomizer.exploreSpreadNote")}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label={t("randomizer.reactivationRuns")}
            description={t("randomizer.reactivationRunsDesc")}
            error={getFieldError("reactivationRuns")}
          >
            <Input
              type="number"
              step="1"
              min={0}
              max={5}
              value={reactivationRuns}
              onChange={(e) => onChangeReactivationRuns(e.target.value)}
              invalid={Boolean(getFieldError("reactivationRuns"))}
            />
          </Field>
          <Field
            label={t("randomizer.anchorEvery")}
            description={t("randomizer.anchorEveryDesc")}
            error={getFieldError("anchorEvery")}
          >
            <Input
              type="number"
              step="1"
              min={0}
              max={20}
              value={anchorEvery}
              onChange={(e) => onChangeAnchorEvery(e.target.value)}
              invalid={Boolean(getFieldError("anchorEvery"))}
            />
          </Field>
          {mode === "alternating" && (
            <Field
              label={t("randomizer.alternatingBlock")}
              description={t("randomizer.alternatingBlockDesc")}
              error={getFieldError("alternatingBlock")}
            >
              <Input
                type="number"
                step="1"
                min={1}
                max={10}
                value={alternatingBlock}
                onChange={(e) => onChangeAlternatingBlock(e.target.value)}
                invalid={Boolean(getFieldError("alternatingBlock"))}
              />
            </Field>
          )}
        </div>
      </div>

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
