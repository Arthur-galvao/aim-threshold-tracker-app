import { useState, useEffect, useMemo } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
import { useI18n, type Key } from "@/lib/i18n";
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
import { Button } from "@/components/ui/Button";
import { RecenterBanner } from "./recenter-banner";
import { RangePresets } from "./range-presets";
import { RangeModeFields } from "./range-mode-fields";
import { RangeToggles } from "./range-toggles";
import { cn } from "@/lib/utils";

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
    return err ? t(err.messageKey as Key) : null;
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
    autoScenarioSens: draft.autoScenarioSens,
    mouseDpi: parsedDpi,
  }), [settings, parsedBase, draft.rangeMode, parsedMinCm, parsedMaxCm, parsedMinMult, parsedMaxMult, draft.spreadPercent, draft.autoScenarioSens, parsedDpi]);

  const previewRange = useRangePreview(
    settingsForPreview,
    draft.autoScenarioSens && idealSens ? idealSens.value : null
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
    if (draft.rangeMode === "multiplier") {
      const minM = parsedMinMult > 0 ? parsedMinMult : 0.75;
      const maxM = parsedMaxMult > minM ? parsedMaxMult : 1.35;
      return parsedBase * Math.sqrt(minM * maxM);
    }
    const minC = parsedMinCm > 0 ? parsedMinCm : 28;
    const maxC = parsedMaxCm > minC ? parsedMaxCm : 55;
    return Math.sqrt(minC * maxC);
  }, [draft.rangeMode, parsedBase, parsedMinMult, parsedMaxMult, parsedMinCm, parsedMaxCm]);

  const recenterSuggestion = useMemo(() => {
    return suggestRecenter(localPrediction, currentCenterCm);
  }, [localPrediction, currentCenterCm]);

  const handleSave = async () => {
    if (!canSave) return;
    const nextSettings = draftToSettings(draft, settings);
    if (draft.autoScenarioSens && idealSens) {
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
      const centerMult = suggested / (parsedBase || 40);
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

  return (
    <div
      style={style}
      className={cn(
        "liquid-surface p-5 rounded-tile flex flex-col justify-between gap-4",
        className
      )}
    >
      {/* Top Header: Calibration status & Save indicator */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-edge">
        <div>
          <h2 className="text-xs font-semibold text-text-main">
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
      />

      <div className="space-y-4">
        {/* In-game preview and presets */}
        <RangePresets
          spreadPercent={draft.spreadPercent}
          onSelectSpread={(p) => setDraft((prev) => updateDraftField(prev, "spreadPercent", p))}
          mouseDpi={draft.mouseDpi}
          onSelectDpi={(dpi) => setDraft((prev) => updateDraftField(prev, "mouseDpi", String(dpi)))}
          inGameValorant={inGameValorant}
          inGameSource={inGameSource}
          parsedDpi={parsedDpi}
        />

        {/* Auto Scenario Sens Switch & Avoid Repeats Switch */}
        <RangeToggles
          autoScenarioSens={draft.autoScenarioSens}
          onToggleAutoScenario={(checked) => setDraft((p) => updateDraftField(p, "autoScenarioSens", checked))}
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
        >
          {t("randomizer.saveSettings")}
        </Button>
      </div>
    </div>
  );
}
