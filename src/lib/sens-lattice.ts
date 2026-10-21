export const LATTICE_ANCHOR_CM = 50.0;
export const LATTICE_RATIO = 1.05;
export const MIN_CM = 5.0;
export const MIN_GRID_POINTS = 3;

const STEP_LN = Math.log(LATTICE_RATIO);

export function latticeCm(k: number): number {
  const v = LATTICE_ANCHOR_CM * Math.pow(LATTICE_RATIO, k);
  return Math.round(v * 100) / 100;
}

export function latticeIndex(cm: number): number {
  const safeCm = Math.max(MIN_CM, cm);
  return Math.round(Math.log(safeCm / LATTICE_ANCHOR_CM) / STEP_LN);
}

export function gridBounds(minCm: number, maxCm: number): [number, number] {
  const safeMin = Math.max(MIN_CM, minCm);
  const safeMax = Math.max(safeMin, maxCm);

  let lo = Math.ceil(Math.log(safeMin / LATTICE_ANCHOR_CM) / STEP_LN - 1e-9);
  let hi = Math.floor(Math.log(safeMax / LATTICE_ANCHOR_CM) / STEP_LN + 1e-9);

  let widenLow = true;
  while (hi - lo + 1 < MIN_GRID_POINTS) {
    if (widenLow && latticeCm(lo - 1) >= MIN_CM) {
      lo -= 1;
    } else {
      hi += 1;
    }
    widenLow = !widenLow;
  }

  return [lo, hi];
}

export function gridPoints(minCm: number, maxCm: number): number[] {
  const [lo, hi] = gridBounds(minCm, maxCm);
  const pts: number[] = [];
  for (let k = lo; k <= hi; k++) {
    pts.push(latticeCm(k));
  }
  return pts;
}

export interface RangeResolutionInput {
  baseSensCm: number;
  rangeMode: "cm360" | "multiplier" | string;
  minCm: number;
  maxCm: number;
  minMult: number;
  maxMult: number;
  spreadPercent: number;
  autoScenarioSens: boolean;
  scenarioIdealCm?: number | null;
}

export function resolveRangeCm(
  s: RangeResolutionInput,
  centerOverride?: number | null
): { minCm: number; maxCm: number } {
  const base = s.baseSensCm > 0 ? s.baseSensCm : 40.0;
  if (s.autoScenarioSens) {
    const rawCenter =
      (centerOverride && centerOverride > 0 ? centerOverride : null) ??
      (s.scenarioIdealCm && s.scenarioIdealCm > 0 ? s.scenarioIdealCm : null) ??
      base;
    const center = Math.max(MIN_CM, rawCenter);
    const p = Math.min(0.9, Math.max(0.01, (s.spreadPercent || 20) / 100.0));
    return {
      minCm: Math.max(MIN_CM, center / (1.0 + p)),
      maxCm: center * (1.0 + p),
    };
  }
  if (String(s.rangeMode).toLowerCase() === "multiplier") {
    const a = Math.max(0.01, Math.min(s.minMult, s.maxMult));
    const b = Math.max(0.01, Math.max(s.minMult, s.maxMult));
    return {
      minCm: Math.max(MIN_CM, base / b),
      maxCm: base / a,
    };
  }
  return {
    minCm: Math.max(MIN_CM, Math.min(s.minCm, s.maxCm)),
    maxCm: Math.max(MIN_CM, Math.max(s.minCm, s.maxCm)),
  };
}

export function computeRangePreview(
  s: RangeResolutionInput,
  centerOverride?: number | null
): {
  minCm: number;
  maxCm: number;
  minMult: number;
  maxMult: number;
  gridCm: number[];
} {
  const base = s.baseSensCm > 0 ? s.baseSensCm : 40.0;
  const { minCm, maxCm } = resolveRangeCm(s, centerOverride);
  const gridCm = gridPoints(minCm, maxCm);
  const minMult = Math.round((base / maxCm) * 10000) / 10000;
  const maxMult = Math.round((base / minCm) * 10000) / 10000;
  return {
    minCm: Math.round(minCm * 100) / 100,
    maxCm: Math.round(maxCm * 100) / 100,
    minMult,
    maxMult,
    gridCm,
  };
}
