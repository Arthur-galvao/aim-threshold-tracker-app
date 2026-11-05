import { useState, useEffect, useMemo } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import type { RandomizerSettings, RandomizerState } from "@/hooks/useSensRandomizer";
import type { Task } from "@/lib/types";
import {
  getScenarioIdealSens, cm360ToValorant, cm360ToSource,
  predictOptimalSensitivity, suggestRecenter,
} from "@/lib/sens-analytics";
import { buildRunPoints } from "@/lib/run-points";
import { useRangePreview } from "@/hooks/useRangePreview";
import {
  initDraft, syncDraftWithSettings, updateDraftField,
  resetDraftTouched, validateDraft, isDraftDirty, draftToSettings,
  type RandomizerDraft,
} from "@/lib/randomizer-draft";
import { directionKey } from "@/lib/randomizer-directions";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import type { RandomizerDirection } from "@/hooks/useSensRandomizer";
import { Button } from "@/components/ui/Button";
import { RecenterBanner } from "./recenter-banner";
import { RangePresets, type RandomizerPreset } from "./range-presets";
import { RangeModeFields } from "./range-mode-fields";
import { RangeToggles } from "./range-toggles";
import { DirectionTable } from "./direction-table";
import { CategoryGates } from "./category-gates";
import { cn } from "@/lib/utils";

const VISCOSE_CATEGORY_NAMES = Object.keys(VISCOSE_CATEGORIES);

export interface ControlsProps {
  settings: RandomizerSettings;
  randomizerState?: RandomizerState;
  rawaccelAvailable?: boolean;
  testing?: boolean;
  onSaveSettings: (settings: RandomizerSettings) => Promise<void>;
  onToggleEnabled?: () => Promise<void>;
  onTriggerRandomize?: () => Promise<void>;
  onDetectPath?: () => Promise<string | null>;
  onTestWriter?: (customPath?: string) => Promise<string>;
  activeTask?: Task | null;
  allTasks?: Task[];
  className?: string;
  style?: React.CSSProperties;
}

export function Controls({
  settings,
  rawaccelAvailable: _rawaccelAvailable,
  onSaveSettings,
  onToggleEnabled: _onToggleEnabled,
  onTriggerRandomize: _onTriggerRandomize,
  activeTask,
  allTasks = [],
  className,
  style,
}: ControlsProps) {
  const { t } = useI18n();

  const [draft, setDraft] = useState<RandomizerDraft>(() => initDraft(settings));
  const [dismissedSuggestionCm, setDismissedSuggestionCm] = useState<number | null>(null);

  useEffect(() => {
    setDraft((prev) => syncDraftWithSettings(prev, settings));
  }, [settings]);

  const validationErrors = useMemo(() => validateDraft(draft), [draft]);
  const isDirty = useMemo(() => isDraftDirty(draft, settings), [draft, settings]);
  const canSave = isDirty && validationErrors.length === 0;

  const getFieldError = (field: string) => {
    const err = validationErrors.find((e) => e.field === field);
    return err ? t(err.messageKey) : null;
  };

  const parsedBase = Number(draft.baseSens) || settings.baseSensCm || 40;
  const parsedMinCm = Number(draft.minCm) || settings.minCm || 28;
  const parsedMaxCm = Number(draft.maxCm) || settings.maxCm || 55;
  const parsedMinMult = Number(draft.minMult) || settings.minMult || 0.75;
  const parsedMaxMult = Number(draft.maxMult) || settings.maxMult || 1.35;
  const parsedDpi = Math.round(Number(draft.mouseDpi)) || settings.mouseDpi || 800;

  const idealSens = useMemo(() => {
    return getScenarioIdealSens(activeTask, allTasks, parsedDpi);
  }, [activeTask, allTasks, parsedDpi]);

  const settingsForPreview = useMemo<RandomizerSettings>(() => ({
    ...settings,
    baseSensCm: parsedBase,
    rangeMode: draft.rangeMode,
    minCm: parsedMinCm,
    maxCm: parsedMaxCm,
    minMult: parsedMinMult,
    maxMult: parsedMaxMult,
    spreadPercent: draft.spreadPercent,
    autoScenarioSens: draft.centerSource !== "base",
    mouseDpi: parsedDpi,
  }), [settings, parsedBase, draft.rangeMode, parsedMinCm, parsedMaxCm, parsedMinMult, parsedMaxMult, draft.spreadPercent, draft.centerSource, parsedDpi]);

  const previewRange = useRangePreview(
    settingsForPreview,
    draft.centerSource !== "base" && idealSens ? idealSens.value : null
  );

  const calculatedRange = useMemo(() => ({
    minCm: previewRange?.minCm ?? (settings.minCm || 28),
    maxCm: previewRange?.maxCm ?? (settings.maxCm || 55),
    gridCm: previewRange?.gridCm ?? [],
  }), [previewRange, settings.minCm, settings.maxCm]);

  const inGameValorant = useMemo(() => cm360ToValorant(parsedBase, parsedDpi), [parsedBase, parsedDpi]);
  const inGameSource = useMemo(() => cm360ToSource(parsedBase, parsedDpi), [parsedBase, parsedDpi]);

  const localPrediction = useMemo(() => {
    if (!activeTask || !activeTask.sessions || activeTask.sessions.length === 0) return null;
    const runPoints = buildRunPoints([activeTask], { dpi: parsedDpi });
    const runs = runPoints.map((p) => ({
      sens: p.sens,
      score: p.score,
      rawScore: p.score,
      normScore: p.rel,
      date: p.date,
      scenario: p.scenario,
      threshold: p.threshold,
    }));
    return predictOptimalSensitivity(runs);
  }, [activeTask, parsedDpi]);

  const currentCenterCm = useMemo(() => {
    if (draft.centerSource !== "base") {
      return idealSens?.value ?? settings.scenarioIdealCm ?? parsedBase;
    }
    if (draft.rangeMode === "multiplier") {
      const minM = parsedMinMult > 0 ? parsedMinMult : 0.75;
      const maxM = parsedMaxMult > minM ? parsedMaxMult : 1.35;
      return parsedBase / Math.sqrt(minM * maxM);
    }
    const minC = parsedMinCm > 0 ? parsedMinCm : 28;
    const maxC = parsedMaxCm > minC ? parsedMaxCm : 55;
    return Math.sqrt(minC * maxC);
  }, [draft.centerSource, idealSens, settings.scenarioIdealCm, draft.rangeMode, parsedBase, parsedMinMult, parsedMaxMult, parsedMinCm, parsedMaxCm]);

  const recenterSuggestion = useMemo(() => {
    return suggestRecenter(localPrediction, currentCenterCm);
  }, [localPrediction, currentCenterCm]);

  const handleSave = async () => {
    if (!canSave) return;
    const nextSettings = draftToSettings(draft, settings);
    if (draft.centerSource !== "base" && idealSens) {
      nextSettings.scenarioIdealCm = idealSens.value;
    }
    await onSaveSettings(nextSettings);
    setDraft((prev) => resetDraftTouched(prev));
  };

  const handleApplyRecenter = async () => {
    if (!recenterSuggestion) return;
    const suggested = recenterSuggestion.suggestedCm;
    if (draft.rangeMode === "multiplier") {
      const currentMin = parsedMinMult > 0 ? parsedMinMult : 0.75;
      const currentMax = parsedMaxMult > currentMin ? parsedMaxMult : 1.35;
      const r = Math.sqrt(currentMax / currentMin);
      const centerMult = (parsedBase || 40) / suggested;
      const nextMin = Number((centerMult / r).toFixed(2));
      const nextMax = Number((centerMult * r).toFixed(2));
      setDraft((prev) => {
        let d = updateDraftField(prev, "minMult", String(nextMin));
        d = updateDraftField(d, "maxMult", String(nextMax));
        d.touched.delete("minMult");
        d.touched.delete("maxMult");
        return d;
      });
      await onSaveSettings({ ...settings, minMult: nextMin, maxMult: nextMax });
    } else {
      const currentMin = parsedMinCm > 0 ? parsedMinCm : 28;
      const currentMax = parsedMaxCm > currentMin ? parsedMaxCm : 55;
      const r = Math.sqrt(currentMax / currentMin);
      const nextMin = Number((suggested / r).toFixed(1));
      const nextMax = Number((suggested * r).toFixed(1));
      setDraft((prev) => {
        let d = updateDraftField(prev, "minCm", String(nextMin));
        d = updateDraftField(d, "maxCm", String(nextMax));
        d.touched.delete("minCm");
        d.touched.delete("maxCm");
        return d;
      });
      await onSaveSettings({ ...settings, minCm: nextMin, maxCm: nextMax });
    }
  };

  const handleApplyPreset = (preset: RandomizerPreset) => {
    setDraft((prev) => {
      let d = updateDraftField(prev, "mode", preset.mode);
      d = updateDraftField(d, "spreadPercent", preset.spreadPercent);
      if (preset.alternatingBlock !== undefined) {
        d = updateDraftField(d, "alternatingBlock", String(preset.alternatingBlock));
      }
      return d;
    });
  };

  const handleChangeDirection = (category: string, subcategory: string, direction: RandomizerDirection) => {
    setDraft((prev) =>
      updateDraftField(prev, "directionOverrides", {
        ...prev.directionOverrides,
        [directionKey(category, subcategory)]: direction,
      })
    );
  };

  const handleRestoreDirections = () => {
    setDraft((prev) => updateDraftField(prev, "directionOverrides", {}));
  };

  const handleToggleCategory = (category: string, enabled: boolean) => {
    setDraft((prev) =>
      updateDraftField(prev, "categoryEnabled", {
        ...prev.categoryEnabled,
        [category]: enabled,
      })
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      style={style}
      onMouseMove={handleMouseMove}
      className={cn(
        "liquid-surface liquid-interactive p-5 rounded-tile flex flex-col justify-between gap-4",
        className
      )}
    >
      {/* Top Header: Calibration status & Save indicator */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-edge">
        <div>
          <h2 className="text-xs font-semibold text-text-main tracking-tight">
            {t("randomizer.mode")}
          </h2>
          <p className="text-[11px] text-text-faint">
            {t("randomizer.enableDesc")}
          </p>
        </div>

        {isDirty && (
          <span className="text-[11px] text-amber font-medium flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
            {t("randomizer.unsavedChanges")}
          </span>
        )}
      </div>

      {/* Recenter Suggestion Banner */}
      {recenterSuggestion && dismissedSuggestionCm !== recenterSuggestion.suggestedCm && (
        <RecenterBanner
          suggestion={recenterSuggestion}
          onApply={handleApplyRecenter}
          onDismiss={() => setDismissedSuggestionCm(recenterSuggestion.suggestedCm)}
        />
      )}

      {/* Mode Selector & Ranges */}
      <RangeModeFields
        rangeMode={draft.rangeMode}
        onChangeRangeMode={(val) => setDraft((p) => updateDraftField(p, "rangeMode", val))}
        minCm={draft.minCm}
        onChangeMinCm={(val) => setDraft((p) => updateDraftField(p, "minCm", val))}
        maxCm={draft.maxCm}
        onChangeMaxCm={(val) => setDraft((p) => updateDraftField(p, "maxCm", val))}
        minMult={draft.minMult}
        onChangeMinMult={(val) => setDraft((p) => updateDraftField(p, "minMult", val))}
        maxMult={draft.maxMult}
        onChangeMaxMult={(val) => setDraft((p) => updateDraftField(p, "maxMult", val))}
        baseSens={draft.baseSens}
        onChangeBaseSens={(val) => setDraft((p) => updateDraftField(p, "baseSens", val))}
        getFieldError={getFieldError}
        mode={draft.mode}
        onChangeMode={(val) => setDraft((p) => updateDraftField(p, "mode", val))}
        reactivationRuns={draft.reactivationRuns}
        onChangeReactivationRuns={(val) => setDraft((p) => updateDraftField(p, "reactivationRuns", val))}
        anchorEvery={draft.anchorEvery}
        onChangeAnchorEvery={(val) => setDraft((p) => updateDraftField(p, "anchorEvery", val))}
        alternatingBlock={draft.alternatingBlock}
        onChangeAlternatingBlock={(val) => setDraft((p) => updateDraftField(p, "alternatingBlock", val))}
      />

      <div className="space-y-4">
        {/* Named presets, in-game preview and spread/DPI */}
        <RangePresets
          mode={draft.mode}
          onApplyPreset={handleApplyPreset}
          spreadPercent={draft.spreadPercent}
          onSelectSpread={(p) => setDraft((prev) => updateDraftField(prev, "spreadPercent", p))}
          mouseDpi={draft.mouseDpi}
          onSelectDpi={(dpi) => setDraft((prev) => updateDraftField(prev, "mouseDpi", String(dpi)))}
          inGameValorant={inGameValorant}
          inGameSource={inGameSource}
          parsedDpi={parsedDpi}
          minCm={calculatedRange.minCm}
          maxCm={calculatedRange.maxCm}
        />

        {/* Center source & Avoid Repeats switch */}
        <RangeToggles
          centerSource={draft.centerSource}
          onChangeCenterSource={(val) => setDraft((p) => updateDraftField(p, "centerSource", val))}
          avoidRepeats={draft.avoidRepeats}
          onToggleAvoidRepeats={(checked) => setDraft((p) => updateDraftField(p, "avoidRepeats", checked))}
          idealSensSummary={
            idealSens
              ? `${idealSens.value.toFixed(1)} cm/360 (${idealSens.source === "empirical" ? t("randomizer.idealSensSourceEmpirical") : t("randomizer.idealSensSourceViscose")})`
              : null
          }
          minCm={calculatedRange.minCm}
          maxCm={calculatedRange.maxCm}
          gridPointsCount={calculatedRange.gridCm.length}
        />

        {draft.mode === "directed" && (
          <DirectionTable
            directionOverrides={draft.directionOverrides}
            onChangeDirection={handleChangeDirection}
            onRestoreDefaults={handleRestoreDirections}
          />
        )}

        <CategoryGates
          categories={VISCOSE_CATEGORY_NAMES}
          categoryEnabled={draft.categoryEnabled}
          onToggleCategory={handleToggleCategory}
        />
      </div>

      {/* Save Button & Dirty State */}
      <div className="pt-2 border-t border-edge flex items-center justify-between gap-3">
        {isDirty ? (
          <span className="text-xs text-amber font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
            {t("randomizer.unsavedChanges")}
          </span>
        ) : (
          <span className="text-xs text-text-faint" />
        )}

        <Button
          variant="primary"
          size="sm"
          disabled={!canSave}
          onClick={() => void handleSave()}
          icon={<FloppyDisk size={14} />}
          className="rounded-full"
        >
          {t("randomizer.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
