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

  const [baseSensStr, setBaseSensStr] = useState(() => String(settings.baseSensCm || 40));
  const [minCmStr, setMinCmStr] = useState(() => String(settings.minCm || 28));
  const [maxCmStr, setMaxCmStr] = useState(() => String(settings.maxCm || 55));
  const [minMultStr, setMinMultStr] = useState(() => String(settings.minMult || 0.75));
  const [maxMultStr, setMaxMultStr] = useState(() => String(settings.maxMult || 1.35));
  const [rangeMode, setRangeMode] = useState<"cm360" | "multiplier">(() =>
    settings.rangeMode === "multiplier" ? "multiplier" : "cm360"
  );
  const [avoidRepeats, setAvoidRepeats] = useState(() => settings.avoidRepeats ?? true);

  useEffect(() => {
    setBaseSensStr(String(settings.baseSensCm || 40));
    setMinCmStr(String(settings.minCm || 28));
    setMaxCmStr(String(settings.maxCm || 55));
    setMinMultStr(String(settings.minMult || 0.75));
    setMaxMultStr(String(settings.maxMult || 1.35));
    setRangeMode(settings.rangeMode === "multiplier" ? "multiplier" : "cm360");
    setAvoidRepeats(settings.avoidRepeats ?? true);
  }, [settings]);

  const parsedBaseSens = parseFloat(baseSensStr) || settings.baseSensCm || 40;
  const parsedMinCm = parseFloat(minCmStr) || settings.minCm || 28;
  const parsedMaxCm = parseFloat(maxCmStr) || settings.maxCm || 55;
  const parsedMinMult = parseFloat(minMultStr) || settings.minMult || 0.75;
  const parsedMaxMult = parseFloat(maxMultStr) || settings.maxMult || 1.35;

  const handleSave = async () => {
    await onSaveSettings({
      ...settings,
      rangeMode,
      avoidRepeats,
      baseSensCm: parsedBaseSens,
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-text-main tracking-tight">
              {t("randomizer.title")}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                settings.enabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-surface-subtle text-text-faint border-edge"
              }`}
            >
              {settings.enabled ? t("randomizer.statusActive") : t("randomizer.statusInactive")}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {t("randomizer.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={onTriggerRandomize}
            disabled={!rawaccelAvailable}
            className="minimal-btn-secondary px-3.5 py-2 text-xs font-semibold rounded-full flex items-center gap-1.5 justify-center flex-1 md:flex-initial disabled:opacity-40 disabled:pointer-events-none"
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
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 justify-center transition-all flex-1 md:flex-initial disabled:opacity-40 disabled:pointer-events-none shadow-sm ${
              settings.enabled
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                : "minimal-btn"
            }`}
          >
            {settings.enabled ? t("randomizer.disableBtn") : t("randomizer.enableBtn")}
          </button>
        </div>
      </div>

      {/* 2-Column Grid: Config & Real-Time Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="panel p-6 rounded-2xl space-y-5">
            <div className="border-b border-edge pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                {t("randomizer.paramsTitle")}
              </h3>
              <p className="text-[11px] text-text-faint mt-0.5">
                {t("randomizer.paramsSubtitle")}
              </p>
            </div>

            {/* Base Sens */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
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
                  value={baseSensStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                      setBaseSensStr(val);
                    }
                  }}
                  onBlur={() => {
                    if (!baseSensStr.trim() || isNaN(parseFloat(baseSensStr))) {
                      setBaseSensStr(String(settings.baseSensCm || 40));
                    }
                  }}
                  className="minimal-input text-xs font-mono font-medium pl-3.5 pr-20 py-2.5 tabular-nums"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                  cm/360
                </div>
              </div>
              <p className="text-[11px] text-text-faint mt-1.5 leading-relaxed">
                {t("randomizer.baseSensHelp")}
              </p>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                {t("randomizer.mode")}
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-subtle rounded-xl border border-edge">
                <button
                  type="button"
                  onClick={() => setRangeMode("cm360")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    rangeMode === "cm360"
                      ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                      : "text-text-secondary hover:text-text-main"
                  }`}
                >
                  <span>{t("randomizer.modeCm")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRangeMode("multiplier")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    rangeMode === "multiplier"
                      ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                      : "text-text-secondary hover:text-text-main"
                  }`}
                >
                  <span>{t("randomizer.modeMult")}</span>
                </button>
              </div>
            </div>

            {/* Range Inputs */}
            {rangeMode === "cm360" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="minCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.min")} (cm/360)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="minCmInput"
                        type="text"
                        inputMode="decimal"
                        value={minCmStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMinCmStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!minCmStr.trim() || isNaN(parseFloat(minCmStr))) {
                            setMinCmStr(String(settings.minCm || 28));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-12 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                        cm
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="maxCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.max")} (cm/360)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="maxCmInput"
                        type="text"
                        inputMode="decimal"
                        value={maxCmStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMaxCmStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!maxCmStr.trim() || isNaN(parseFloat(maxCmStr))) {
                            setMaxCmStr(String(settings.maxCm || 55));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-12 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                        cm
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px]">
                  <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
                  <span className="text-text-main font-mono font-semibold">
                    {parsedMinCm.toFixed(1)} cm {t("randomizer.rangeTo")} {parsedMaxCm.toFixed(1)} cm
                    {parsedBaseSens > 0 && parsedMinCm > 0 && parsedMaxCm > 0 && (
                      <span className="text-text-faint font-normal ml-1.5">
                        ({(parsedBaseSens / parsedMaxCm).toFixed(2)}x {t("randomizer.rangeTo")} {(parsedBaseSens / parsedMinCm).toFixed(2)}x)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="minMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.min")} {t("randomizer.multSuffix")}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="minMultInput"
                        type="text"
                        inputMode="decimal"
                        value={minMultStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMinMultStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!minMultStr.trim() || isNaN(parseFloat(minMultStr))) {
                            setMinMultStr(String(settings.minMult || 0.75));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-10 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-bold text-text-faint pointer-events-none">
                        x
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="maxMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.max")} {t("randomizer.multSuffix")}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="maxMultInput"
                        type="text"
                        inputMode="decimal"
                        value={maxMultStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMaxMultStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!maxMultStr.trim() || isNaN(parseFloat(maxMultStr))) {
                            setMaxMultStr(String(settings.maxMult || 1.35));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-10 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-bold text-text-faint pointer-events-none">
                        x
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px]">
                  <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
                  <span className="text-text-main font-mono font-semibold">
                    {parsedMinMult.toFixed(2)}x {t("randomizer.rangeTo")} {parsedMaxMult.toFixed(2)}x
                    {parsedBaseSens > 0 && parsedMinMult > 0 && parsedMaxMult > 0 && (
                      <span className="text-text-faint font-normal ml-1.5">
                        ({(parsedBaseSens / parsedMaxMult).toFixed(1)} cm {t("randomizer.rangeTo")} {(parsedBaseSens / parsedMinMult).toFixed(1)} cm)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Avoid Repeats */}
            <label
              htmlFor="avoidRepeatsCheck"
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                avoidRepeats
                  ? "bg-surface-subtle border-edge-strong"
                  : "bg-surface-subtle/40 border-edge hover:bg-surface-subtle/70"
              }`}
            >
              <input
                id="avoidRepeatsCheck"
                type="checkbox"
                checked={avoidRepeats}
                onChange={(e) => setAvoidRepeats(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-edge-strong bg-surface text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-text-main block">
                  {t("randomizer.avoidRepeats")}
                </span>
                <span className="text-[11px] text-text-faint block mt-0.5 leading-relaxed">
                  {t("randomizer.avoidRepeatsHelp")}
                </span>
              </div>
            </label>

            {/* Save Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 px-4 minimal-btn text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
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
        </div>

        {/* Right Column: Driver Telemetry & Live Status */}
        <div className="lg:col-span-6 space-y-6">
          <div className="panel p-6 rounded-2xl space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main border-b border-edge pb-3">
              {t("randomizer.telemetryTitle")}
            </h3>

            {/* Big Active Sens KPI Card */}
            <div className="p-5 rounded-xl bg-surface-subtle border border-edge flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-text-faint font-medium">
                  {t("randomizer.activeSens")}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-mono font-bold text-text-main">
                    {randomizerState.activeSensCm.toFixed(2)}
                  </span>
                  <span className="text-sm font-mono text-text-secondary">cm/360</span>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-edge sm:pl-6">
                <span className="text-xs uppercase tracking-wider text-text-faint font-medium">
                  {t("randomizer.activeMult")}
                </span>
                <div className="flex items-baseline gap-2 mt-1 justify-end">
                  <span className="text-2xl font-mono font-bold text-blue-400">
                    {randomizerState.activeMult.toFixed(2)}x
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
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

            {/* RawAccel Integration Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{t("randomizer.rawaccelPath")}</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                    rawaccelAvailable
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-rose-500/10 text-rose-400"
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

              <div className="p-3 rounded-xl bg-surface-subtle font-mono text-[11px] text-text-secondary border border-edge break-all flex items-center justify-between gap-2">
                <span>{settings.rawaccelDir || t("randomizer.noPathDetected")}</span>
                {!rawaccelAvailable && (
                  <button
                    type="button"
                    onClick={onDetectPath}
                    className="text-xs text-blue-400 hover:text-blue-300 underline font-sans flex-shrink-0"
                  >
                    {t("randomizer.detectPath")}
                  </button>
                )}
              </div>
            </div>

            {/* Test Multiplier Writer */}
            <div className="pt-2 border-t border-edge flex items-center justify-between">
              <div className="text-xs text-text-faint">
                {t("randomizer.testDriverTooltip")}
              </div>
              <button
                type="button"
                onClick={() => onTestWriter()}
                disabled={testing || !rawaccelAvailable}
                className="minimal-btn-secondary px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40"
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
    </div>
  );
}
