import type { RandomizerDirection } from "../hooks/useSensRandomizer.ts";

/** Categoria -> subcategoria -> direção. Sugestão inicial baseada na Viscose (Plano 05). */
export type DirectionTable = Record<string, Record<string, RandomizerDirection>>;

/** Fator do deslocamento do centro no modo `directed`: c' = c·(1 + s·0.6p). */
export const DIRECTED_SHIFT_FACTOR = 0.6;

/**
 * Tabela padrão do modo `directed`.
 * rápida (fast) = menos cm/360 (pulso/dedos) · lenta (slow) = mais cm/360 (braço).
 */
export const DEFAULT_DIRECTIONS: DirectionTable = {
  "Flick Tech": {
    Speed: "slow",
    Stability: "neutral",
    Micro: "fast",
    "Post-Flick": "neutral",
  },
  "Click Timing": {
    Reading: "neutral",
    Precision: "fast",
    Stability: "neutral",
  },
  "Control Tracking": {
    Arm: "slow",
    Wrist: "fast",
    Fingertip: "fast",
    Blending: "neutral",
  },
  "Reactive Tracking": {
    Control: "neutral",
    Speed: "slow",
    Reading: "neutral",
  },
};

/** Chave usada em `directionOverrides`: "Categoria/Subcategoria". */
export function directionKey(category: string, subcategory: string): string {
  return `${category}/${subcategory}`;
}

/** Direção padrão (tabela Viscose); "neutral" para combinações fora da tabela. */
export function defaultDirection(category: string, subcategory: string): RandomizerDirection {
  return DEFAULT_DIRECTIONS[category]?.[subcategory] ?? "neutral";
}

/** Direção efetiva: override do usuário, senão a sugestão padrão. */
export function resolveDirection(
  overrides: Record<string, RandomizerDirection> | undefined,
  category: string,
  subcategory: string
): RandomizerDirection {
  const override = overrides?.[directionKey(category, subcategory)];
  return override ?? defaultDirection(category, subcategory);
}

/** Sinal do deslocamento: lenta = +1 (centro sobe), rápida = -1, neutra = 0. */
export function directionSign(direction: RandomizerDirection): -1 | 0 | 1 {
  if (direction === "slow") return 1;
  if (direction === "fast") return -1;
  return 0;
}

/** Centro deslocado do modo `directed`. `spreadFraction` é p em fração (25% = 0.25). */
export function directedCenterCm(
  centerCm: number,
  spreadFraction: number,
  direction: RandomizerDirection
): number {
  return centerCm * (1 + directionSign(direction) * DIRECTED_SHIFT_FACTOR * spreadFraction);
}

/** Faixa [c'(1−p), c'(1+p)] do modo `directed`. */
export function directedRange(
  centerCm: number,
  spreadFraction: number,
  direction: RandomizerDirection
): { loCm: number; hiCm: number } {
  const shifted = directedCenterCm(centerCm, spreadFraction, direction);
  return {
    loCm: shifted * (1 - spreadFraction),
    hiCm: shifted * (1 + spreadFraction),
  };
}
