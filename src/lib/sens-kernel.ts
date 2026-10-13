import { latticeCm } from "./sens-lattice.ts";

export interface BinStat {
  k: number;
  cm: number;
  n: number;
  mean: number;
  sd: number | null;
  smooth: number;
  looSmooth: number;
}

/**
 * Agrupa pontos pela grade exponencial e calcula media, desvio padrao e suavizacao por kernel.
 */
export function binByLattice(points: Array<{ k: number; rel: number }>): BinStat[] {
  if (!points || points.length === 0) return [];

  const groups = new Map<number, number[]>();
  for (const pt of points) {
    if (typeof pt.k !== "number" || isNaN(pt.k) || typeof pt.rel !== "number" || isNaN(pt.rel)) {
      continue;
    }
    const arr = groups.get(pt.k) ?? [];
    arr.push(pt.rel);
    groups.set(pt.k, arr);
  }

  if (groups.size === 0) return [];

  const rawBins: Array<{ k: number; cm: number; n: number; mean: number; sd: number | null }> = [];
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const k of sortedKeys) {
    const vals = groups.get(k)!;
    const n = vals.length;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    let sd: number | null = null;
    if (n >= 2) {
      const sqDiffSum = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
      sd = Math.sqrt(sqDiffSum / (n - 1));
    }

    rawBins.push({
      k,
      cm: latticeCm(k),
      n,
      mean,
      sd,
    });
  }

  const h = 1.5;
  const result: BinStat[] = [];

  for (let i = 0; i < rawBins.length; i++) {
    const target = rawBins[i];
    let weightSum = 0;
    let smoothSum = 0;
    let looWeightSum = 0;
    let looSum = 0;

    for (let j = 0; j < rawBins.length; j++) {
      const other = rawBins[j];
      const d = (target.k - other.k) / h;
      const w = other.n * Math.exp(-0.5 * d * d);

      weightSum += w;
      smoothSum += w * other.mean;

      if (i !== j) {
        looWeightSum += w;
        looSum += w * other.mean;
      }
    }

    const smooth = weightSum > 0 ? smoothSum / weightSum : target.mean;
    const looSmooth = looWeightSum > 0 ? looSum / looWeightSum : target.mean;

    result.push({
      ...target,
      smooth,
      looSmooth,
    });
  }

  return result;
}

/**
 * Cria avaliador de suavizacao por kernel com largura de banda h (passos).
 */
export function kernelSmooth(bins: BinStat[], h = 1.5): (k: number) => number {
  if (!bins || bins.length === 0) {
    return () => 0;
  }

  return (k: number) => {
    let weightSum = 0;
    let smoothSum = 0;

    for (const b of bins) {
      const d = (k - b.k) / h;
      const w = b.n * Math.exp(-0.5 * d * d);
      weightSum += w;
      smoothSum += w * b.mean;
    }

    return weightSum > 0 ? smoothSum / weightSum : 0;
  };
}

export function kernelSupport(k: number, bins: BinStat[], h = 1.5): number {
  let sum = 0;
  for (const b of bins) {
    const d = (k - b.k) / h;
    sum += b.n * Math.exp(-0.5 * d * d);
  }
  return sum;
}
