import type { RandomizerSettings } from "@/hooks/useSensRandomizer";

export interface RandomizerDraft {
  baseSens: string;
  minCm: string;
  maxCm: string;
  minMult: string;
  maxMult: string;
  spreadPercent: number;
  mouseDpi: string;
  rangeMode: "cm360" | "multiplier";
  avoidRepeats: boolean;
  autoScenarioSens: boolean;
  touched: Set<string>;
}

export interface DraftValidationError {
  field: string;
  messageKey: string;
}

export function initDraft(settings: RandomizerSettings): RandomizerDraft {
  return {
    baseSens: String(settings.baseSensCm ?? 40),
    minCm: String(settings.minCm ?? 28),
    maxCm: String(settings.maxCm ?? 55),
    minMult: String(settings.minMult ?? 0.75),
    maxMult: String(settings.maxMult ?? 1.35),
    spreadPercent: settings.spreadPercent ?? 25.0,
    mouseDpi: String(settings.mouseDpi ?? 800),
    rangeMode: settings.rangeMode === "multiplier" ? "multiplier" : "cm360",
    avoidRepeats: settings.avoidRepeats ?? true,
    autoScenarioSens: settings.autoScenarioSens ?? true,
    touched: new Set<string>(),
  };
}

export function syncDraftWithSettings(
  draft: RandomizerDraft,
  settings: RandomizerSettings
): RandomizerDraft {
  return {
    baseSens: draft.touched.has("baseSens") ? draft.baseSens : String(settings.baseSensCm ?? 40),
    minCm: draft.touched.has("minCm") ? draft.minCm : String(settings.minCm ?? 28),
    maxCm: draft.touched.has("maxCm") ? draft.maxCm : String(settings.maxCm ?? 55),
    minMult: draft.touched.has("minMult") ? draft.minMult : String(settings.minMult ?? 0.75),
    maxMult: draft.touched.has("maxMult") ? draft.maxMult : String(settings.maxMult ?? 1.35),
    spreadPercent: draft.touched.has("spreadPercent") ? draft.spreadPercent : (settings.spreadPercent ?? 25.0),
    mouseDpi: draft.touched.has("mouseDpi") ? draft.mouseDpi : String(settings.mouseDpi ?? 800),
    rangeMode: draft.touched.has("rangeMode") ? draft.rangeMode : (settings.rangeMode === "multiplier" ? "multiplier" : "cm360"),
    avoidRepeats: draft.touched.has("avoidRepeats") ? draft.avoidRepeats : (settings.avoidRepeats ?? true),
    autoScenarioSens: draft.touched.has("autoScenarioSens") ? draft.autoScenarioSens : (settings.autoScenarioSens ?? true),
    touched: new Set(draft.touched),
  };
}

export function updateDraftField<K extends keyof Omit<RandomizerDraft, "touched">>(
  draft: RandomizerDraft,
  field: K,
  value: RandomizerDraft[K]
): RandomizerDraft {
  const nextTouched = new Set(draft.touched);
  nextTouched.add(field);
  return {
    ...draft,
    [field]: value,
    touched: nextTouched,
  };
}

export function resetDraftTouched(draft: RandomizerDraft): RandomizerDraft {
  return {
    ...draft,
    touched: new Set<string>(),
  };
}

export function validateDraft(draft: RandomizerDraft): DraftValidationError[] {
  const errors: DraftValidationError[] = [];

  const base = Number(draft.baseSens);
  if (!Number.isFinite(base) || base < 10 || base > 200) {
    errors.push({ field: "baseSens", messageKey: "randomizer.errorBaseSensRange" });
  }

  const dpi = Number(draft.mouseDpi);
  if (!Number.isFinite(dpi) || dpi < 100 || dpi > 32000 || !Number.isInteger(dpi)) {
    errors.push({ field: "mouseDpi", messageKey: "randomizer.errorDpiRange" });
  }

  if (draft.rangeMode === "cm360") {
    const minCm = Number(draft.minCm);
    const maxCm = Number(draft.maxCm);
    if (!Number.isFinite(minCm) || minCm < 5) {
      errors.push({ field: "minCm", messageKey: "randomizer.errorMinCmFloor" });
    }
    if (!Number.isFinite(maxCm) || maxCm <= 0) {
      errors.push({ field: "maxCm", messageKey: "randomizer.errorMaxCmInvalid" });
    }
    if (Number.isFinite(minCm) && Number.isFinite(maxCm) && minCm >= maxCm) {
      errors.push({ field: "minCm", messageKey: "randomizer.errorMinMaxOrder" });
    }
  } else {
    const minMult = Number(draft.minMult);
    const maxMult = Number(draft.maxMult);
    if (!Number.isFinite(minMult) || minMult <= 0) {
      errors.push({ field: "minMult", messageKey: "randomizer.errorMinMultPositive" });
    }
    if (!Number.isFinite(maxMult) || maxMult <= 0) {
      errors.push({ field: "maxMult", messageKey: "randomizer.errorMaxMultPositive" });
    }
    if (Number.isFinite(minMult) && Number.isFinite(maxMult) && minMult >= maxMult) {
      errors.push({ field: "minMult", messageKey: "randomizer.errorMinMaxOrder" });
    }
  }

  if (!Number.isFinite(draft.spreadPercent) || draft.spreadPercent < 1 || draft.spreadPercent > 100) {
    errors.push({ field: "spreadPercent", messageKey: "randomizer.errorSpreadRange" });
  }

  return errors;
}

export function isDraftDirty(draft: RandomizerDraft, settings: RandomizerSettings): boolean {
  if (draft.touched.size > 0) return true;
  if (Number(draft.baseSens) !== settings.baseSensCm) return true;
  if (draft.rangeMode !== settings.rangeMode) return true;
  if (Number(draft.minCm) !== settings.minCm) return true;
  if (Number(draft.maxCm) !== settings.maxCm) return true;
  if (Number(draft.minMult) !== settings.minMult) return true;
  if (Number(draft.maxMult) !== settings.maxMult) return true;
  if (draft.spreadPercent !== settings.spreadPercent) return true;
  if (Number(draft.mouseDpi) !== settings.mouseDpi) return true;
  if (draft.avoidRepeats !== settings.avoidRepeats) return true;
  if (draft.autoScenarioSens !== settings.autoScenarioSens) return true;
  return false;
}

export function draftToSettings(
  draft: RandomizerDraft,
  baseSettings: RandomizerSettings
): RandomizerSettings {
  return {
    ...baseSettings,
    baseSensCm: Number(draft.baseSens),
    rangeMode: draft.rangeMode,
    minCm: Number(draft.minCm),
    maxCm: Number(draft.maxCm),
    minMult: Number(draft.minMult),
    maxMult: Number(draft.maxMult),
    spreadPercent: draft.spreadPercent,
    mouseDpi: Math.round(Number(draft.mouseDpi)),
    avoidRepeats: draft.avoidRepeats,
    autoScenarioSens: draft.autoScenarioSens,
  };
}
