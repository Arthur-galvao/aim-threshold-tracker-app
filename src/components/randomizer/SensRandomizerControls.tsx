import { useState, useEffect, useMemo } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import type { RandomizerSettings, RandomizerState } from "@/hooks/useSensRandomizer";
import type { Task } from "@/lib/types";
import {
  getScenarioIdealSens,
  cm360ToValorant,
  cm360ToSource,
  predictOptimalSensitivity,
  suggestRecenter,
} from "@/lib/sens-analytics";
import { buildRunPoints } from "@/lib/run-points";
import { useRangePreview } from "@/hooks/useRangePreview";
import {
  initDraft,
  syncDraftWithSettings,
  updateDraftField,
  resetDraftTouched,
  validateDraft,
  isDraftDirty,
  draftToSettings,
  type RandomizerDraft,
} from "@/lib/randomizer-draft";

interface SensRandomizerControlsProps {
  settings: RandomizerSettings;
  randomizerState: RandomizerState;
  rawaccelAvailable: boolean;
  testing: boolean;
  onSaveSettings: (settings: RandomizerSettings) => Promise<void>;
  onToggleEnabled: () => Promise<void>;
  onTriggerRandomize: () => Promise<void>;
  onDetectPath: () => Promise<string | null>;
  onTestWriter: (customPath?: string) => Promise<string>;
  activeTask?: Task | null;
  allTasks?: Task[];
}

export function SensRandomizerControls({
  settings,
  randomizerState,
  rawaccelAvailable,
  testing,
  onSaveSettings,
  onToggleEnabled,
  onTriggerRandomize,
  onDetectPath,
  onTestWriter,
  activeTask,
  allTasks,
}: SensRandomizerControlsProps) {
  const { t } = useI18n();

  const [draft, setDraft] = useState<RandomizerDraft>(() => initDraft(settings));

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

  const parsedBase = Number(draft.baseSens) || settings.baseSensCm || 50;
  const parsedMinCm = Number(draft.minCm) || settings.minCm || 20;
  const parsedMaxCm = Number(draft.maxCm) || settings.maxCm || 90;
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
    minCm: previewRange?.minCm ?? (settings.minCm || 20),
    maxCm: previewRange?.maxCm ?? (settings.maxCm || 90),
    minMult: previewRange?.minMult ?? (settings.minMult || 0.75),
    maxMult: previewRange?.maxMult ?? (settings.maxMult || 1.35),
    gridCm: previewRange?.gridCm ?? [],
  }), [previewRange, settings.minCm, settings.maxCm, settings.minMult, settings.maxMult]);

  const inGameValorant = useMemo(() => {
    return cm360ToValorant(parsedBase, parsedDpi);
  }, [parsedBase, parsedDpi]);

  const inGameSource = useMemo(() => {
    return cm360ToSource(parsedBase, parsedDpi);
  }, [parsedBase, parsedDpi]);

  const handleSave = async () => {
    if (!canSave) return;
    const nextSettings = draftToSettings(draft, settings);
    if (draft.autoScenarioSens && idealSens) {
      nextSettings.scenarioIdealCm = idealSens.value;
    }
    await onSaveSettings(nextSettings);
    setDraft((prev) => resetDraftTouched(prev));
  };

  const handleToggleAutoScenario = async (checked: boolean) => {
    setDraft((prev) => {
      const next = updateDraftField(prev, "autoScenarioSens", checked);
      next.touched.delete("autoScenarioSens");
      return next;
    });
    await onSaveSettings({
      ...settings,
      autoScenarioSens: checked,
      scenarioIdealCm: checked && idealSens ? idealSens.value : undefined,
    });
    if (checked && settings.enabled && rawaccelAvailable) {
      await onTriggerRandomize();
    }
  };

  const handleSelectDpiPreset = async (preset: number) => {
    setDraft((prev) => {
      const next = updateDraftField(prev, "mouseDpi", String(preset));
      next.touched.delete("mouseDpi");
      return next;
    });
    await onSaveSettings({ ...settings, mouseDpi: preset });
  };

  const handleSelectSpreadPreset = async (preset: number) => {
    setDraft((prev) => {
      const next = updateDraftField(prev, "spreadPercent", preset);
      next.touched.delete("spreadPercent");
      return next;
    });
    await onSaveSettings({ ...settings, spreadPercent: preset });
  };

  const handleSelectRangeMode = async (mode: "cm360" | "multiplier") => {
    setDraft((prev) => {
      const next = updateDraftField(prev, "rangeMode", mode);
      next.touched.delete("rangeMode");
      return next;
    });
    await onSaveSettings({ ...settings, rangeMode: mode });
  };

  const handleToggleAvoidRepeats = async (checked: boolean) => {
    setDraft((prev) => {
      const next = updateDraftField(prev, "avoidRepeats", checked);
      next.touched.delete("avoidRepeats");
      return next;
    });
    await onSaveSettings({ ...settings, avoidRepeats: checked });
  };

  const multDeltaPercent = useMemo(() => {
    return (randomizerState.activeMult - 1.0) * 100;
  }, [randomizerState.activeMult]);

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
    const minC = parsedMinCm > 0 ? parsedMinCm : 20;
    const maxC = parsedMaxCm > minC ? parsedMaxCm : 90;
    return Math.sqrt(minC * maxC);
  }, [draft.rangeMode, parsedBase, parsedMinMult, parsedMaxMult, parsedMinCm, parsedMaxCm]);

  const [dismissedSuggestionCm, setDismissedSuggestionCm] = useState<number | null>(null);

  const recenterSuggestion = useMemo(() => {
    return suggestRecenter(localPrediction, currentCenterCm);
  }, [localPrediction, currentCenterCm]);

  const handleApplyRecenter = async () => {
    if (!recenterSuggestion) return;
    const suggested = recenterSuggestion.suggestedCm;
    if (draft.rangeMode === "multiplier") {
      const currentMin = parsedMinMult > 0 ? parsedMinMult : 0.75;
      const currentMax = parsedMaxMult > currentMin ? parsedMaxMult : 1.35;
      const r = Math.sqrt(currentMax / currentMin);
      const centerMult = suggested / (parsedBase || 50);
      const nextMinMult = Number((centerMult / r).toFixed(2));
      const nextMaxMult = Number((centerMult * r).toFixed(2));
      setDraft((prev) => {
        let d = updateDraftField(prev, "minMult", String(nextMinMult));
        d = updateDraftField(d, "maxMult", String(nextMaxMult));
        d.touched.delete("minMult");
        d.touched.delete("maxMult");
        return d;
      });
      await onSaveSettings({
        ...settings,
        minMult: nextMinMult,
        maxMult: nextMaxMult,
      });
    } else {
      const currentMin = parsedMinCm > 0 ? parsedMinCm : 20;
      const currentMax = parsedMaxCm > currentMin ? parsedMaxCm : 90;
      const r = Math.sqrt(currentMax / currentMin);
      const nextMinCm = Number((suggested / r).toFixed(1));
      const nextMaxCm = Number((suggested * r).toFixed(1));
      setDraft((prev) => {
        let d = updateDraftField(prev, "minCm", String(nextMinCm));
        d = updateDraftField(d, "maxCm", String(nextMaxCm));
        d.touched.delete("minCm");
        d.touched.delete("maxCm");
        return d;
      });
      await onSaveSettings({
        ...settings,
        minCm: nextMinCm,
        maxCm: nextMaxCm,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Primary Actions */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-text-main tracking-tight">
              {t("randomizer.title")}
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                settings.enabled
                  ? "bg-emerald-soft text-emerald border-emerald-edge"
                  : "bg-surface-subtle text-text-faint border-edge"
              }`}
            >
              {settings.enabled ? t("randomizer.statusActive") : t("randomizer.statusInactive")}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("randomizer.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onTriggerRandomize}
            disabled={!rawaccelAvailable}
            className="minimal-btn-secondary px-3.5 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 justify-center flex-1 sm:flex-initial disabled:opacity-40 disabled:pointer-events-none press cursor-pointer"
            title={t("randomizer.rollNowTooltip")}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{t("randomizer.rollNow")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleEnabled}
            disabled={!rawaccelAvailable}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 justify-center transition-all flex-1 sm:flex-initial disabled:opacity-40 disabled:pointer-events-none shadow-xs press cursor-pointer ${
              settings.enabled
                ? "bg-red-soft text-red border border-red-edge hover:bg-red-soft/80"
                : "bg-score text-primary-foreground hover:brightness-105"
            }`}
          >
            {settings.enabled ? t("randomizer.disableBtn") : t("randomizer.enableBtn")}
          </button>
        </div>
      </div>

      {/* Recenter Suggestion Banner (Manual mode only) */}
      {!draft.autoScenarioSens && recenterSuggestion && dismissedSuggestionCm !== recenterSuggestion.suggestedCm && (
        <div className="p-3.5 rounded-2xl bg-score-soft border border-score/25 text-score text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-score flex-shrink-0" />
            <span>
              {t("randomizer.recenterSuggestion")}:{" "}
              <strong className="text-text-main tabular-nums">{recenterSuggestion.suggestedCm.toFixed(1)} cm</strong>{" "}
              <span className="text-text-secondary tabular-nums">({t("randomizer.recenterCurrent")}: {recenterSuggestion.currentCm.toFixed(1)} cm)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setDismissedSuggestionCm(recenterSuggestion.suggestedCm)}
              className="px-2.5 py-1 text-[11px] font-medium text-text-faint hover:text-text-secondary rounded-lg transition-colors press cursor-pointer"
            >
              {t("randomizer.dismiss")}
            </button>
            <button
              type="button"
              onClick={handleApplyRecenter}
              className="px-3 py-1 text-[11px] font-bold bg-score hover:brightness-105 text-primary-foreground rounded-lg transition-all shadow-xs press cursor-pointer"
            >
              {t("randomizer.applySens")}
            </button>
          </div>
        </div>
      )}

      {/* Raw Accel GUI Running Warning Banner */}
      {randomizerState.rawaccelGuiRunning && (
        <div className="p-3.5 rounded-2xl bg-amber-soft border border-amber-edge text-amber text-xs flex items-center gap-2.5 shadow-xs">
          <svg
            className="w-4 h-4 flex-shrink-0 text-amber"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="font-medium">{t("randomizer.rawaccelGuiRunning")}</span>
        </div>
      )}

      {/* Main 2-Column Grid: Config & Telemetry */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">
        {/* Left Column: Parameter Configuration */}
        <div className="glass-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-edge pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.paramsTitle")}
            </h3>
            <p className="text-[11px] text-text-faint">
              {t("randomizer.paramsSubtitle")}
            </p>
          </div>

          {/* Active Scenario & Ideal Sensitivity Card */}
          <div className="p-3.5 rounded-xl border border-edge bg-surface-subtle/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  {t("randomizer.activeScenarioTitle")}
                </span>
                <p className="text-xs font-bold text-text-main truncate mt-0.5" title={activeTask?.name ?? t("randomizer.scopeNone")}>
                  {activeTask?.name ?? t("randomizer.scopeNone")}
                </p>
              </div>

              {idealSens && (
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint block">
                    {t("randomizer.idealSensLabel")}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                    <span className="text-xs font-mono font-bold text-score tabular-nums">
                      {idealSens.value} cm
                    </span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold border ${
                        idealSens.source === "empirical"
                          ? "bg-emerald-soft text-emerald border-emerald-edge"
                          : "bg-surface-subtle text-text-faint border-edge"
                      }`}
                      title={idealSens.source === "empirical" ? t("randomizer.idealSensSourceEmpirical") : t("randomizer.idealSensSourceViscose")}
                    >
                      {idealSens.source === "empirical" ? "EMP" : "VIS"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Sync Toggle */}
            <label
              htmlFor="autoScenarioSensCheck"
              className="flex items-center justify-between p-2 rounded-lg bg-surface border border-edge hover:bg-surface-hover/50 transition-colors cursor-pointer text-xs"
            >
              <div className="pr-2">
                <span className="font-semibold text-text-main block">
                  {t("randomizer.autoScenarioSens")}
                </span>
                <span className="text-[10px] text-text-faint block">
                  {t("randomizer.autoScenarioSensDesc")}
                </span>
              </div>
              <input
                id="autoScenarioSensCheck"
                type="checkbox"
                checked={draft.autoScenarioSens}
                onChange={(e) => void handleToggleAutoScenario(e.target.checked)}
                className="w-4 h-4 rounded border-edge-strong bg-surface text-score cursor-pointer accent-score shrink-0"
              />
            </label>
          </div>

          {/* Mouse Hardware DPI */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                {t("randomizer.mouseDpi")}
              </label>
              <span className="text-[10px] text-score font-mono font-bold tabular-nums">
                {parsedDpi} DPI
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[400, 800, 1600, 3200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleSelectDpiPreset(preset)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors press cursor-pointer tabular-nums ${
                    parsedDpi === preset && draft.mouseDpi === String(preset)
                      ? "bg-score text-primary-foreground"
                      : "bg-surface border border-edge text-text-secondary hover:text-text-main hover:bg-surface-hover"
                  }`}
                >
                  {preset}
                </button>
              ))}
              <div className="flex items-center ml-auto">
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.mouseDpi}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    setDraft((prev) => updateDraftField(prev, "mouseDpi", clean));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-16 glass-input py-1 px-2 text-[11px] font-mono font-medium text-right tabular-nums"
                  aria-label={t("randomizer.mouseDpi")}
                />
                <span className="ml-1 text-[10px] font-mono text-text-muted uppercase">DPI</span>
              </div>
            </div>
            {getFieldError("mouseDpi") && (
              <span className="text-[11px] text-red mt-1 block font-medium">
                {getFieldError("mouseDpi")}
              </span>
            )}
          </div>

          {/* Base Sens Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="baseSensInput" className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                {t("randomizer.baseSens")}
              </label>
              <span className="text-[10px] text-text-faint font-mono">
                {t("randomizer.baseSensSource")}
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                id="baseSensInput"
                type="text"
                inputMode="decimal"
                value={draft.baseSens}
                onChange={(e) => {
                  const val = e.target.value.replace(",", ".");
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setDraft((prev) => updateDraftField(prev, "baseSens", val));
                  }
                }}
                className="glass-input text-xs font-mono font-medium pl-3 pr-16 py-2 tabular-nums"
              />
              <span className="absolute right-2 text-[10px] font-mono text-text-faint uppercase pointer-events-none">
                cm/360
              </span>
            </div>
            {getFieldError("baseSens") && (
              <span className="text-[11px] text-red mt-1 block font-medium">
                {getFieldError("baseSens")}
              </span>
            )}

            {/* In-Game Equivalent Preview */}
            <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface border border-edge font-mono text-text-secondary">
              <span className="text-[10px] text-text-faint uppercase font-semibold">{t("randomizer.inGameEquivalent")}:</span>
              <div className="flex items-center gap-3">
                <span>
                  <span className="text-text-faint">Val:</span>{" "}
                  <strong className="text-text-main tabular-nums">{inGameValorant.toFixed(3)}</strong>
                </span>
                <span>
                  <span className="text-text-faint">Source:</span>{" "}
                  <strong className="text-text-main tabular-nums">{inGameSource.toFixed(3)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Spread Percentage Control (±%) */}
          <div className="p-3 rounded-xl border border-edge bg-surface-subtle/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="spreadSlider" className="text-[11px] font-semibold uppercase tracking-wider text-text-main block">
                  {t("randomizer.spreadPercent")}
                </label>
                <span className="text-[10px] text-text-faint">
                  {t("randomizer.spreadPercentDesc")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-bold text-text-main tabular-nums">
                  ±{draft.spreadPercent}%
                </span>
              </div>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-3">
              <input
                id="spreadSlider"
                type="range"
                min={5}
                max={75}
                step={1}
                value={draft.spreadPercent}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDraft((prev) => updateDraftField(prev, "spreadPercent", val));
                }}
                className="w-full accent-score cursor-pointer h-1.5 bg-surface rounded-lg border border-edge"
              />
            </div>
            {getFieldError("spreadPercent") && (
              <span className="text-[11px] text-red mt-1 block font-medium">
                {getFieldError("spreadPercent")}
              </span>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {[15, 20, 25, 30, 35].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleSelectSpreadPreset(preset)}
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-all press cursor-pointer tabular-nums ${
                    draft.spreadPercent === preset
                      ? "bg-score-soft text-score border-score/30"
                      : "bg-surface hover:bg-surface-hover text-text-secondary border-edge"
                  }`}
                >
                  ±{preset}%
                </button>
              ))}
            </div>

            {/* Real-time Calculated Range */}
            <div className="pt-1 border-t border-edge flex items-center justify-between text-[11px] flex-wrap gap-1">
              <span className="text-text-faint">{t("randomizer.spreadCalculatedRange")}</span>
              <span className="font-mono font-semibold text-text-main whitespace-nowrap tabular-nums">
                {draft.rangeMode === "cm360"
                  ? `${calculatedRange.minCm.toFixed(1)} cm - ${calculatedRange.maxCm.toFixed(1)} cm`
                  : `${calculatedRange.minMult.toFixed(2)}x - ${calculatedRange.maxMult.toFixed(2)}x`}
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
              {t("randomizer.mode")}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-subtle rounded-xl border border-edge">
              <button
                type="button"
                onClick={() => void handleSelectRangeMode("cm360")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all press cursor-pointer ${
                  draft.rangeMode === "cm360"
                    ? "bg-surface text-text-main shadow-xs border border-edge-strong"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {t("randomizer.modeCm")}
              </button>
              <button
                type="button"
                onClick={() => void handleSelectRangeMode("multiplier")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all press cursor-pointer ${
                  draft.rangeMode === "multiplier"
                    ? "bg-surface text-text-main shadow-xs border border-edge-strong"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {t("randomizer.modeMult")}
              </button>
            </div>
          </div>

          {/* Range Inputs */}
          {draft.rangeMode === "cm360" ? (
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="minCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                    {t("randomizer.min")} (cm)
                  </label>
                  <input
                    id="minCmInput"
                    type="text"
                    inputMode="decimal"
                    value={draft.autoScenarioSens ? String(calculatedRange.minCm) : draft.minCm}
                    disabled={draft.autoScenarioSens}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setDraft((prev) => updateDraftField(prev, "minCm", val));
                      }
                    }}
                    className="glass-input text-xs font-mono font-medium px-3 py-2 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="maxCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                    {t("randomizer.max")} (cm)
                  </label>
                  <input
                    id="maxCmInput"
                    type="text"
                    inputMode="decimal"
                    value={draft.autoScenarioSens ? String(calculatedRange.maxCm) : draft.maxCm}
                    disabled={draft.autoScenarioSens}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setDraft((prev) => updateDraftField(prev, "maxCm", val));
                      }
                    }}
                    className="glass-input text-xs font-mono font-medium px-3 py-2 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              {(getFieldError("minCm") || getFieldError("maxCm")) && (
                <span className="text-[11px] text-red mt-1 block font-medium">
                  {getFieldError("minCm") || getFieldError("maxCm")}
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="minMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                    {t("randomizer.min")} (x)
                  </label>
                  <input
                    id="minMultInput"
                    type="text"
                    inputMode="decimal"
                    value={draft.autoScenarioSens ? String(calculatedRange.minMult) : draft.minMult}
                    disabled={draft.autoScenarioSens}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setDraft((prev) => updateDraftField(prev, "minMult", val));
                      }
                    }}
                    className="glass-input text-xs font-mono font-medium px-3 py-2 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="maxMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                    {t("randomizer.max")} (x)
                  </label>
                  <input
                    id="maxMultInput"
                    type="text"
                    inputMode="decimal"
                    value={draft.autoScenarioSens ? String(calculatedRange.maxMult) : draft.maxMult}
                    disabled={draft.autoScenarioSens}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setDraft((prev) => updateDraftField(prev, "maxMult", val));
                      }
                    }}
                    className="glass-input text-xs font-mono font-medium px-3 py-2 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              {(getFieldError("minMult") || getFieldError("maxMult")) && (
                <span className="text-[11px] text-red mt-1 block font-medium">
                  {getFieldError("minMult") || getFieldError("maxMult")}
                </span>
              )}
            </div>
          )}

          {/* Configured Range Summary */}
          <div className="px-3 py-1.5 rounded-lg bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px] flex-wrap gap-1">
            <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
            <span className="text-text-main font-mono font-semibold whitespace-nowrap tabular-nums">
              {draft.rangeMode === "cm360"
                ? `${(draft.autoScenarioSens ? calculatedRange.minCm : parsedMinCm).toFixed(1)} cm - ${(draft.autoScenarioSens ? calculatedRange.maxCm : parsedMaxCm).toFixed(1)} cm`
                : `${(draft.autoScenarioSens ? calculatedRange.minMult : parsedMinMult).toFixed(2)}x - ${(draft.autoScenarioSens ? calculatedRange.maxMult : parsedMaxMult).toFixed(2)}x`}
            </span>
          </div>

          {/* Grid Points Real Preview Chips */}
          {calculatedRange.gridCm.length > 0 && (
            <div className="p-2.5 rounded-xl border border-edge bg-surface-subtle/40 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-text-faint uppercase tracking-wider">
                  {t("randomizer.gridPoints")} ({calculatedRange.gridCm.length})
                </span>
                <span className="text-[10px] text-text-faint font-mono tabular-nums">
                  {calculatedRange.gridCm[0].toFixed(1)} - {calculatedRange.gridCm[calculatedRange.gridCm.length - 1].toFixed(1)} cm
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap max-h-24 overflow-y-auto">
                {calculatedRange.gridCm.map((cm, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-surface border border-edge text-text-secondary tabular-nums"
                  >
                    {cm.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Avoid Repeats Checkbox */}
          <label
            htmlFor="avoidRepeatsCheck"
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-edge bg-surface-subtle/50 hover:bg-surface-subtle transition-colors cursor-pointer text-xs"
          >
            <input
              id="avoidRepeatsCheck"
              type="checkbox"
              checked={draft.avoidRepeats}
              onChange={(e) => void handleToggleAvoidRepeats(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-edge-strong bg-surface text-score cursor-pointer accent-score"
            />
            <span className="font-medium text-text-main">
              {t("randomizer.avoidRepeats")}
            </span>
          </label>

          {/* Save Button & Unsaved Changes Indicator */}
          <div className="space-y-2">
            {isDirty && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-soft border border-amber-edge text-amber text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                  <span>{t("randomizer.unsavedChanges")}</span>
                </div>
                {validationErrors.length > 0 && (
                  <span className="text-[10px] text-red font-mono tabular-nums">
                    {validationErrors.length} {validationErrors.length === 1 ? "erro" : "erros"}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="w-full py-2 px-4 rounded-xl bg-score text-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:brightness-105 press transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{t("randomizer.saveSettings")}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Telemetry & Status */}
        <div className="glass-panel p-4 sm:p-5 space-y-4">
          <div className="border-b border-edge pb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.telemetryTitle")}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                rawaccelAvailable ? "bg-emerald-soft text-emerald border-emerald-edge" : "bg-red-soft text-red border border-red-edge"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  rawaccelAvailable ? "bg-emerald" : "bg-red"
                }`}
              />
              {rawaccelAvailable ? t("randomizer.ready") : t("randomizer.notReady")}
            </span>
          </div>

          {/* Big Active Sens KPI Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-surface-subtle border border-edge flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
                {t("randomizer.activeSens")}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-text-main tabular-nums">
                  {randomizerState.activeSensCm.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-text-secondary">cm/360</span>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-edge pt-2.5 sm:pt-0 sm:pl-4">
              <span className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
                {t("randomizer.activeMult")}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5 justify-start sm:justify-end">
                <span className="text-xl font-mono font-bold text-score tabular-nums">
                  {randomizerState.activeMult.toFixed(2)}x
                </span>
                <span
                  className={`text-[11px] font-mono font-semibold tabular-nums ${
                    multDeltaPercent > 0
                      ? "text-emerald"
                      : multDeltaPercent < 0
                      ? "text-amber"
                      : "text-text-faint"
                  }`}
                >
                  ({multDeltaPercent >= 0 ? "+" : ""}
                  {multDeltaPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* RawAccel Path Information */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-secondary font-medium">{t("randomizer.rawaccelPath")}</span>
              {!rawaccelAvailable && (
                <button
                  type="button"
                  onClick={onDetectPath}
                  className="text-score hover:underline font-sans press cursor-pointer"
                >
                  {t("randomizer.detectPath")}
                </button>
              )}
            </div>
            <div className="p-2.5 rounded-xl bg-surface-subtle font-mono text-[11px] text-text-secondary border border-edge break-all">
              {settings.rawaccelDir || t("randomizer.noPathDetected")}
            </div>
          </div>

          {/* Driver Test Button */}
          <div className="pt-2 border-t border-edge flex items-center justify-between">
            <span className="text-[11px] text-text-faint">
              {t("randomizer.testDriverTooltip")}
            </span>
            <button
              type="button"
              onClick={() => onTestWriter()}
              disabled={testing || !rawaccelAvailable}
              className="minimal-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 press cursor-pointer"
            >
              {testing ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <span>{t("randomizer.testWriter")}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
