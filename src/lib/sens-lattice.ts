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
