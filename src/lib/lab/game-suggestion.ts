// Laboratório (Plano 06 / T6.3): sugestão direcional de sens por jogo.
// Pesos são "estimativa inicial" editáveis; a frase é sempre direcional (nunca "use exatamente X").
// cm/360 MENOR = sens mais RÁPIDA.

import type { Key } from "../i18n.tsx";
import type { CategoryRange, RangeConfidence } from "./category-range.ts";
import { cmToGame, formatGameSens, type GameDef } from "./games.ts";

/** Peso por categoria (nome da categoria da task) para cada jogo. Editável. */
export type CategoryWeights = Record<string, number>;

export const DEFAULT_GAME_WEIGHTS: Record<string, CategoryWeights> = {
  valorant: { "Click Timing": 0.4, "Flick Tech": 0.4, "Reactive Tracking": 0.1, "Control Tracking": 0.1 },
  cs2: { "Click Timing": 0.45, "Flick Tech": 0.45, "Reactive Tracking": 0.05, "Control Tracking": 0.05 },
  apex: { "Control Tracking": 0.35, "Reactive Tracking": 0.35, "Flick Tech": 0.2, "Click Timing": 0.1 },
  ow2: { "Reactive Tracking": 0.3, "Flick Tech": 0.3, "Control Tracking": 0.25, "Click Timing": 0.15 },
  fortnite: { "Flick Tech": 0.35, "Reactive Tracking": 0.25, "Control Tracking": 0.2, "Click Timing": 0.2 },
  r6: { "Click Timing": 0.5, "Flick Tech": 0.4, "Reactive Tracking": 0.1 },
};

export const CONFIDENCE_FACTOR: Record<RangeConfidence, number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
  insufficient: 0,
};

/** Soma mínima de pesos efetivos para haver sugestão. */
export const MIN_EFFECTIVE_WEIGHT = 0.3;

export interface CategoryContribution {
  category: string;
  subcategory: string;
  effectiveWeight: number;
}

export type GameSuggestion =
  | { status: "insufficient"; totalWeight: number; contributions: CategoryContribution[] }
  | {
      status: "ok";
      centerCm: number;
      loCm: number;
      hiCm: number;
      totalWeight: number;
      contributions: CategoryContribution[];
    };

/** Peso efetivo = peso da categoria / nº de subcategorias utilizáveis da categoria × fator de confiança. */
export function effectiveWeights(
  ranges: CategoryRange[],
  weights: CategoryWeights,
): Array<CategoryContribution & { range: CategoryRange }> {
  const usable = ranges.filter(
    (r) => r.centerCm !== null && r.loCm !== null && r.hiCm !== null && CONFIDENCE_FACTOR[r.confidence] > 0,
  );
  const perCategory = new Map<string, number>();
  for (const r of usable) perCategory.set(r.category, (perCategory.get(r.category) ?? 0) + 1);

  const out: Array<CategoryContribution & { range: CategoryRange }> = [];
  for (const r of usable) {
    const cw = weights[r.category] ?? 0;
    if (!(cw > 0)) continue;
    const n = perCategory.get(r.category) ?? 1;
    out.push({
      category: r.category,
      subcategory: r.subcategory,
      effectiveWeight: (cw / n) * CONFIDENCE_FACTOR[r.confidence],
      range: r,
    });
  }
  return out;
}

/** Média geométrica ponderada. Pesos <= 0 ou valores <= 0 são ignorados; vazio -> NaN. */
export function weightedGeometricMean(items: Array<{ value: number; weight: number }>): number {
  let sw = 0;
  let sl = 0;
  for (const { value, weight } of items) {
    if (!(weight > 0) || !(value > 0)) continue;
    sw += weight;
    sl += weight * Math.log(value);
  }
  return sw > 0 ? Math.exp(sl / sw) : Number.NaN;
}

export function suggestForGame(
  ranges: CategoryRange[],
  weights: CategoryWeights,
): GameSuggestion {
  const eff = effectiveWeights(ranges, weights);
  const totalWeight = eff.reduce((s, e) => s + e.effectiveWeight, 0);
  const contributions: CategoryContribution[] = eff.map(({ category, subcategory, effectiveWeight }) => ({
    category,
    subcategory,
    effectiveWeight,
  }));
  if (totalWeight < MIN_EFFECTIVE_WEIGHT) return { status: "insufficient", totalWeight, contributions };

  const gm = (pick: (r: CategoryRange) => number) =>
    weightedGeometricMean(eff.map((e) => ({ value: pick(e.range), weight: e.effectiveWeight })));
  return {
    status: "ok",
    centerCm: gm((r) => r.centerCm as number),
    loCm: gm((r) => r.loCm as number),
    hiCm: gm((r) => r.hiCm as number),
    totalWeight,
    contributions,
  };
}

export type VerdictKind = "inside" | "faster_than_range" | "slower_than_range";

export interface Verdict {
  kind: VerdictKind;
  /**
   * Quanto a sens atual está além da borda mais próxima, em % (0 se dentro).
   * faster: loCm / currentCm - 1 (velocidade acima da borda rápida);
   * slower: currentCm / hiCm - 1 (cm/360 acima da borda lenta).
   */
  distancePct: number;
}

export function verdict(currentCm: number, loCm: number, hiCm: number): Verdict {
  if (currentCm < loCm) return { kind: "faster_than_range", distancePct: (loCm / currentCm - 1) * 100 };
  if (currentCm > hiCm) return { kind: "slower_than_range", distancePct: (currentCm / hiCm - 1) * 100 };
  return { kind: "inside", distancePct: 0 };
}

export interface PhraseResult {
  key: Key;
  params: Record<string, string | number>;
}

const fmtCm = (v: number) => v.toFixed(1);
const fmtPct = (v: number) => String(Math.round(v));

/**
 * Monta a frase direcional como chave i18n + parâmetros (ver docs/plans/i18n-pending/T6.3.json).
 * Chaves: lab.phrase.insufficient | lab.phrase.range | lab.phrase.inside | lab.phrase.faster | lab.phrase.slower.
 * Os valores em sens do jogo vêm com o lado trocado: cm/360 menor = sens do jogo maior.
 */
export function directionalPhrase(
  suggestion: GameSuggestion,
  game: GameDef,
  dpi: number,
  currentCm?: number | null,
): PhraseResult {
  if (suggestion.status === "insufficient") {
    return { key: "lab.phrase.insufficient", params: { game: game.name } };
  }
  const { loCm, hiCm } = suggestion;
  // cm menor -> sens do jogo maior; "gameLo/gameHi" em ordem crescente.
  const gameA = cmToGame(hiCm, dpi, game);
  const gameB = cmToGame(loCm, dpi, game);
  const params: Record<string, string | number> = {
    game: game.name,
    loCm: fmtCm(loCm),
    hiCm: fmtCm(hiCm),
    gameLo: formatGameSens(Math.min(gameA, gameB), game),
    gameHi: formatGameSens(Math.max(gameA, gameB), game),
  };
  if (currentCm === undefined || currentCm === null || !(currentCm > 0)) {
    return { key: "lab.phrase.range", params };
  }
  const v = verdict(currentCm, loCm, hiCm);
  params.currentCm = fmtCm(currentCm);
  if (v.kind === "inside") return { key: "lab.phrase.inside", params };
  params.pct = fmtPct(v.distancePct);
  return {
    key: v.kind === "faster_than_range" ? "lab.phrase.faster" : "lab.phrase.slower",
    params,
  };
}
