import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type { RandomizerSettings, RandomizerState } from "@/hooks/useSensRandomizer";

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
}: SensRandomizerControlsProps) {
  const { t } = useI18n();

  const [form, setForm] = useState({
    baseSens: String(settings.baseSensCm || 50),
    minCm: String(settings.minCm || 20),
    maxCm: String(settings.maxCm || 90),
    minMult: String(settings.minMult || 0.75),
    maxMult: String(settings.maxMult || 1.35),
    rangeMode: (settings.rangeMode === "multiplier" ? "multiplier" : "cm360") as "cm360" | "multiplier",
    avoidRepeats: settings.avoidRepeats ?? true,
  });

  useEffect(() => {
    setForm({
      baseSens: String(settings.baseSensCm || 50),
      minCm: String(settings.minCm || 20),
      maxCm: String(settings.maxCm || 90),
      minMult: String(settings.minMult || 0.75),
      maxMult: String(settings.maxMult || 1.35),
      rangeMode: settings.rangeMode === "multiplier" ? "multiplier" : "cm360",
      avoidRepeats: settings.avoidRepeats ?? true,
    });
  }, [settings]);

  const parsedBase = parseFloat(form.baseSens) || settings.baseSensCm || 50;
  const parsedMinCm = parseFloat(form.minCm) || settings.minCm || 20;
  const parsedMaxCm = parseFloat(form.maxCm) || settings.maxCm || 90;
  const parsedMinMult = parseFloat(form.minMult) || settings.minMult || 0.75;
  const parsedMaxMult = parseFloat(form.maxMult) || settings.maxMult || 1.35;

  const handleSave = async () => {
    await onSaveSettings({
      ...settings,
      rangeMode: form.rangeMode,
      avoidRepeats: form.avoidRepeats,
      baseSensCm: parsedBase,
      minCm: parsedMinCm,
      maxCm: parsedMaxCm,
      minMult: parsedMinMult,
      maxMult: parsedMaxMult,
    });
  };

  const deltaFromBasePercent = useMemo(() => {
    if (settings.baseSensCm <= 0) return 0;
    const diff = randomizerState.activeSensCm - settings.baseSensCm;
    return (diff / settings.baseSensCm) * 100;
  }, [randomizerState.activeSensCm, settings.baseSensCm]);

  const updateField = (key: keyof typeof form, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Primary Actions */}
      <div className="panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-text-main tracking-tight">
              {t("randomizer.title")}
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                settings.enabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
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
            className="minimal-btn-secondary px-3.5 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 justify-center flex-1 sm:flex-initial disabled:opacity-40 disabled:pointer-events-none"
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
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 justify-center transition-all flex-1 sm:flex-initial disabled:opacity-40 disabled:pointer-events-none shadow-sm ${
              settings.enabled
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                : "minimal-btn"
            }`}
          >
            {settings.enabled ? t("randomizer.disableBtn") : t("randomizer.enableBtn")}
          </button>
        </div>
      </div>

      {/* Raw Accel GUI Running Warning Banner */}
      {randomizerState.rawaccelGuiRunning && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5 shadow-sm">
          <svg
            className="w-4 h-4 flex-shrink-0 text-amber-400"
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Parameter Configuration */}
        <div className="lg:col-span-6 panel p-5 rounded-2xl space-y-4">
          <div className="border-b border-edge pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.paramsTitle")}
            </h3>
            <p className="text-[11px] text-text-faint">
              {t("randomizer.paramsSubtitle")}
            </p>
          </div>

          {/* Base Sens Input */}
          <div>
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
                value={form.baseSens}
                onChange={(e) => {
                  const val = e.target.value.replace(",", ".");
                  if (val === "" || /^\d*\.?\d*$/.test(val)) updateField("baseSens", val);
                }}
                onBlur={() => {
                  if (!form.baseSens.trim() || isNaN(parseFloat(form.baseSens))) {
                    updateField("baseSens", String(settings.baseSensCm || 50));
                  }
                }}
                className="minimal-input text-xs font-mono font-medium pl-3 pr-16 py-2 tabular-nums"
              />
              <span className="absolute right-2 text-[10px] font-mono text-text-faint uppercase pointer-events-none">
                cm/360
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
                onClick={() => updateField("rangeMode", "cm360")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  form.rangeMode === "cm360"
                    ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {t("randomizer.modeCm")}
              </button>
              <button
                type="button"
                onClick={() => updateField("rangeMode", "multiplier")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  form.rangeMode === "multiplier"
                    ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                    : "text-text-secondary hover:text-text-main"
                }`}
              >
                {t("randomizer.modeMult")}
              </button>
            </div>
          </div>

          {/* Range Inputs */}
          {form.rangeMode === "cm360" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="minCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                  {t("randomizer.min")} (cm)
                </label>
                <input
                  id="minCmInput"
                  type="text"
                  inputMode="decimal"
                  value={form.minCm}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) updateField("minCm", val);
                  }}
                  onBlur={() => {
                    if (!form.minCm.trim() || isNaN(parseFloat(form.minCm))) updateField("minCm", String(settings.minCm || 20));
                  }}
                  className="minimal-input text-xs font-mono font-medium px-3 py-2 tabular-nums"
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
                  value={form.maxCm}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) updateField("maxCm", val);
                  }}
                  onBlur={() => {
                    if (!form.maxCm.trim() || isNaN(parseFloat(form.maxCm))) updateField("maxCm", String(settings.maxCm || 90));
                  }}
                  className="minimal-input text-xs font-mono font-medium px-3 py-2 tabular-nums"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="minMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1">
                  {t("randomizer.min")} (x)
                </label>
                <input
                  id="minMultInput"
                  type="text"
                  inputMode="decimal"
                  value={form.minMult}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) updateField("minMult", val);
                  }}
                  onBlur={() => {
                    if (!form.minMult.trim() || isNaN(parseFloat(form.minMult))) updateField("minMult", String(settings.minMult || 0.75));
                  }}
                  className="minimal-input text-xs font-mono font-medium px-3 py-2 tabular-nums"
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
                  value={form.maxMult}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) updateField("maxMult", val);
                  }}
                  onBlur={() => {
                    if (!form.maxMult.trim() || isNaN(parseFloat(form.maxMult))) updateField("maxMult", String(settings.maxMult || 1.35));
                  }}
                  className="minimal-input text-xs font-mono font-medium px-3 py-2 tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Configured Range Summary */}
          <div className="px-3 py-1.5 rounded-lg bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px]">
            <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
            <span className="text-text-main font-mono font-semibold">
              {form.rangeMode === "cm360"
                ? `${parsedMinCm.toFixed(1)} cm - ${parsedMaxCm.toFixed(1)} cm`
                : `${parsedMinMult.toFixed(2)}x - ${parsedMaxMult.toFixed(2)}x`}
            </span>
          </div>

          {/* Avoid Repeats Checkbox */}
          <label
            htmlFor="avoidRepeatsCheck"
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-edge bg-surface-subtle/50 hover:bg-surface-subtle transition-colors cursor-pointer text-xs"
          >
            <input
              id="avoidRepeatsCheck"
              type="checkbox"
              checked={form.avoidRepeats}
              onChange={(e) => updateField("avoidRepeats", e.target.checked)}
              className="w-3.5 h-3.5 rounded border-edge-strong bg-surface text-accent cursor-pointer accent-blue-500"
            />
            <span className="font-medium text-text-main">
              {t("randomizer.avoidRepeats")}
            </span>
          </label>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2 px-4 minimal-btn text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:opacity-90 active:scale-[0.99] transition-all"
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

        {/* Right Column: Telemetry & Status */}
        <div className="lg:col-span-6 panel p-5 rounded-2xl space-y-4">
          <div className="border-b border-edge pb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.telemetryTitle")}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                rawaccelAvailable ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  rawaccelAvailable ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {rawaccelAvailable ? t("randomizer.ready") : t("randomizer.notReady")}
            </span>
          </div>

          {/* Big Active Sens KPI Card */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-edge flex items-center justify-between">
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

            <div className="text-right border-l border-edge pl-4">
              <span className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
                {t("randomizer.activeMult")}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5 justify-end">
                <span className="text-xl font-mono font-bold text-blue-400 tabular-nums">
                  {randomizerState.activeMult.toFixed(2)}x
                </span>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    deltaFromBasePercent > 0
                      ? "text-emerald-400"
                      : deltaFromBasePercent < 0
                      ? "text-amber-400"
                      : "text-text-faint"
                  }`}
                >
                  ({deltaFromBasePercent >= 0 ? "+" : ""}
                  {deltaFromBasePercent.toFixed(1)}%)
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
                  className="text-blue-400 hover:text-blue-300 underline font-sans"
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
              className="minimal-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40"
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
