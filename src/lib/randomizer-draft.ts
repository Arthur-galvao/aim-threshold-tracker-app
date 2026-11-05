import type { Key } from "./i18n.tsx";
import type {
  RandomizerSettings,
  RandomizerMode,
  RandomizerCenterSource,
  RandomizerDirection,
} from "@/hooks/useSensRandomizer";

/** Limites do Plano 05 (T5.7g). */
export const RANDOMIZER_LIMITS = {
  spreadMinPercent: 5,
  spreadMaxPercent: 40,
  /** Modo explore: teto sobe para 60. */
  spreadMaxExplorePercent: 60,
  /** Modo explore: variação efetiva é no mínimo este valor. */
  exploreMinSpreadPercent: 40,
  reactivationRunsMax: 5,
  anchorEveryMax: 20,
  alternatingBlockMin: 1,
  alternatingBlockMax: 10,
} as const;

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
  mode: RandomizerMode;
  centerSource: RandomizerCenterSource;
  reactivationRuns: string;
  anchorEvery: string;
  alternatingBlock: string;
  categoryEnabled: Record<string, boolean>;
  directionOverrides: Record<string, RandomizerDirection>;
  touched: Set<string>;
}

export interface DraftValidationError {
  field: string;
  messageKey: Key;
}

/**
 * Variação efetiva usada pelo sorteio. No modo explore a faixa nunca fica
 * abaixo de 40%; nos demais modos é exatamente o valor escolhido.
 */
export function effectiveSpreadPercent(mode: RandomizerMode, spreadPercent: number): number {
  if (mode === "explore") {
    return Math.max(spreadPercent, RANDOMIZER_LIMITS.exploreMinSpreadPercent);
  }
  return spreadPercent;
}

/** Inteiro em [min, max]; string vazia ou decimal é inválida. */
function isIntegerInRange(raw: string, min: number, max: number): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= min && n <= max;
}

function parseIntegerOr(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function recordsEqual<V>(a: Record<string, V>, b: Record<string, V>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Categoria ausente = habilitada. */
function categoryEnabledEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? true) !== (b[k] ?? true)) return false;
  }
  return true;
}

function legacyCenterSource(settings: RandomizerSettings): RandomizerCenterSource {
  if (settings.centerSource) return settings.centerSource;
  // Migração: autoScenarioSens=false era o centro na base.
  return settings.autoScenarioSens === false ? "base" : "personal_relative";
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
    mode: settings.mode ?? "center",
    centerSource: legacyCenterSource(settings),
    reactivationRuns: String(settings.reactivationRuns ?? 2),
    anchorEvery: String(settings.anchorEvery ?? 5),
    alternatingBlock: String(settings.alternatingBlock ?? 3),
    categoryEnabled: { ...(settings.categoryEnabled ?? {}) },
    directionOverrides: { ...(settings.directionOverrides ?? {}) },
    touched: new Set<string>(),
  };
}

export function syncDraftWithSettings(
  draft: RandomizerDraft,
  settings: RandomizerSettings
): RandomizerDraft {
  const fresh = initDraft(settings);
  const pick = <K extends keyof Omit<RandomizerDraft, "touched">>(key: K): RandomizerDraft[K] =>
    draft.touched.has(key) ? draft[key] : fresh[key];

  return {
    baseSens: pick("baseSens"),
    minCm: pick("minCm"),
    maxCm: pick("maxCm"),
    minMult: pick("minMult"),
    maxMult: pick("maxMult"),
    spreadPercent: pick("spreadPercent"),
    mouseDpi: pick("mouseDpi"),
    rangeMode: pick("rangeMode"),
    avoidRepeats: pick("avoidRepeats"),
    mode: pick("mode"),
    centerSource: pick("centerSource"),
    reactivationRuns: pick("reactivationRuns"),
    anchorEvery: pick("anchorEvery"),
    alternatingBlock: pick("alternatingBlock"),
    categoryEnabled: pick("categoryEnabled"),
    directionOverrides: pick("directionOverrides"),
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

  const isExplore = draft.mode === "explore";
  const spreadMax = isExplore
    ? RANDOMIZER_LIMITS.spreadMaxExplorePercent
    : RANDOMIZER_LIMITS.spreadMaxPercent;
  if (
    !Number.isFinite(draft.spreadPercent) ||
    draft.spreadPercent < RANDOMIZER_LIMITS.spreadMinPercent ||
    draft.spreadPercent > spreadMax
  ) {
    errors.push({ field: "spreadPercent", messageKey: "randomizer.errorSpreadRangeV2" });
  }

  if (!isIntegerInRange(draft.reactivationRuns, 0, RANDOMIZER_LIMITS.reactivationRunsMax)) {
    errors.push({ field: "reactivationRuns", messageKey: "randomizer.errorReactivationRange" });
  }

  if (!isIntegerInRange(draft.anchorEvery, 0, RANDOMIZER_LIMITS.anchorEveryMax)) {
    errors.push({ field: "anchorEvery", messageKey: "randomizer.errorAnchorRange" });
  }

  // Campo visível só no modo alternado: não bloqueia salvar nos outros modos.
  if (
    draft.mode === "alternating" &&
    !isIntegerInRange(
      draft.alternatingBlock,
      RANDOMIZER_LIMITS.alternatingBlockMin,
      RANDOMIZER_LIMITS.alternatingBlockMax
    )
  ) {
    errors.push({ field: "alternatingBlock", messageKey: "randomizer.errorAlternatingBlockRange" });
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
  if (draft.mode !== (settings.mode ?? "center")) return true;
  if (draft.centerSource !== legacyCenterSource(settings)) return true;
  if (Number(draft.reactivationRuns) !== (settings.reactivationRuns ?? 2)) return true;
  if (Number(draft.anchorEvery) !== (settings.anchorEvery ?? 5)) return true;
  if (Number(draft.alternatingBlock) !== (settings.alternatingBlock ?? 3)) return true;
  if (!categoryEnabledEqual(draft.categoryEnabled, settings.categoryEnabled ?? {})) return true;
  if (!recordsEqual(draft.directionOverrides, settings.directionOverrides ?? {})) return true;
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
    // Campo legado mantido coerente para leitores antigos.
    autoScenarioSens: draft.centerSource !== "base",
    mode: draft.mode,
    centerSource: draft.centerSource,
    reactivationRuns: parseIntegerOr(draft.reactivationRuns, 2),
    anchorEvery: parseIntegerOr(draft.anchorEvery, 5),
    alternatingBlock: parseIntegerOr(draft.alternatingBlock, 3),
    categoryEnabled: { ...draft.categoryEnabled },
    directionOverrides: { ...draft.directionOverrides },
  };
}
