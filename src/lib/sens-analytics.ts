export interface BucketStat {
  rangeLabel: string;
  min: number;
  max: number;
  count: number;
  avgScore: number;
  maxScore: number;
  stdDev: number | null;
  consistency: number | null;
  weightedScore: number;
  confidenceLevel: "high" | "medium" | "low" | "insufficient";
}

export interface SweetSpotAnalysis {
  minSens: number;
  maxSens: number;
  totalRuns: number;
  bestBucket: BucketStat | null;
  isProvisional: boolean;
  minEligibleRuns: number;
  buckets: BucketStat[];
  globalMeanScore: number;
}

export interface RunDataPoint {
  sens: number;
  score: number;
  rawScore?: number;
  normScore?: number;
  scenario?: string;
  date?: string;
  threshold?: number;
}

/**
 * Converte sensibilidade angular do motor do Valorant para cm/360 real a um dado DPI.
 * Caso o valor já esteja na escala física de cm/360 (ex.: >= 2.5), retorna o próprio valor.
 */
export function valorantToCm360(sens: number, dpi: number = 800): number {
  if (sens <= 0) return sens;
  if (sens < 2.5) {
    const yaw = 0.07;
    // Formula fisica: (360 graus * 2.54 cm/pol) / (yaw * sens * dpi contagens/pol)
    return Number(((360 * 2.54) / (yaw * dpi * sens)).toFixed(1));
  }
  return sens;
}

/**
 * Formata um valor de sensibilidade para exibicao amigavel com unidade (padrao: cm).
 */
export function formatSensitivity(sens: number, unit: string = "cm"): string {
  if (!sens || sens <= 0) return "-";
  const effectiveSens = valorantToCm360(sens);
  const rounded = Number(effectiveSens.toFixed(1));
  const formattedNumber = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return unit ? `${formattedNumber} ${unit}` : formattedNumber;
}

/**
 * Calcula a curva de regressao quadratica (parabola y = ax^2 + bx + c) usando o metodo
 * dos minimos quadrados e resolucao pelo sistema linear 3x3 com a regra de Cramer.
 */
export function calculateParabolicTrendline(
  points: Array<{ x: number; y: number }>,
  steps: number = 30
): Array<{ x: number; y: number }> {
  if (points.length < 4) {
    return [];
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const xMin = sorted[0].x;
  const xMax = sorted[sorted.length - 1].x;

  if (xMax - xMin < 0.1) {
    return [];
  }

  let sumX = 0;
  let sumX2 = 0;
  let sumX3 = 0;
  let sumX4 = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2Y = 0;
  const n = sorted.length;

  for (const pt of sorted) {
    const x = pt.x;
    const y = pt.y;
    sumX += x;
    sumX2 += x * x;
    sumX3 += x * x * x;
    sumX4 += x * x * x * x;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x * x * y;
  }

  const d =
    n * (sumX2 * sumX4 - sumX3 * sumX3) -
    sumX * (sumX * sumX4 - sumX2 * sumX3) +
    sumX2 * (sumX * sumX3 - sumX2 * sumX2);

  if (Math.abs(d) <= 1e-7) {
    return [];
  }

  const da =
    sumY * (sumX2 * sumX4 - sumX3 * sumX3) -
    sumX * (sumXY * sumX4 - sumX2Y * sumX3) +
    sumX2 * (sumXY * sumX3 - sumX2Y * sumX2);
  const db =
    n * (sumXY * sumX4 - sumX2Y * sumX3) -
    sumY * (sumX * sumX4 - sumX2 * sumX3) +
    sumX2 * (sumX * sumX2Y - sumX2 * sumXY);
  const dc =
    n * (sumX2 * sumX2Y - sumX3 * sumXY) -
    sumX * (sumX * sumX2Y - sumX2 * sumXY) +
    sumY * (sumX * sumX3 - sumX2 * sumX2);

  const c = da / d;
  const b = db / d;
  const a = dc / d;

  const trendPoints: Array<{ x: number; y: number }> = [];
  const stepSize = (xMax - xMin) / steps;

  for (let i = 0; i <= steps; i++) {
    const xVal = xMin + i * stepSize;
    const yVal = a * xVal * xVal + b * xVal + c;
    trendPoints.push({
      x: Number(xVal.toFixed(1)),
      y: Math.max(0, Math.round(yVal)),
    });
  }

  return trendPoints;
}

/**
 * Executa analise estatistica de Sweet Spot sobre sessoes de treino:
 * 1. Agrupamento dinamico por faixas de sensibilidade (tamanho default: 5 cm).
 * 2. Encolhimento Bayesiano empirico (k=3) para mitigar distorcoes de amostra pequena.
 * 3. Variancia amostral com correcao de Bessel (n-1).
 * 4. Atribuicao de confianca estatistica (Alta, Media, Baixa, Insuficiente).
 * 5. Selecao da melhor faixa baseada no score ponderado Bayesiano.
 */
export function computeSweetSpotAnalytics(
  runs: RunDataPoint[],
  bucketSize: number = 5
): SweetSpotAnalysis | null {
  if (!runs || runs.length === 0) {
    return null;
  }

  const sensList = runs.map((r) => r.sens);
  const minSens = Math.floor(Math.min(...sensList));
  const maxSens = Math.ceil(Math.max(...sensList));

  const totalScores = runs.map((r) => r.score);
  const globalMeanScore =
    totalScores.reduce((a, b) => a + b, 0) / (totalScores.length || 1);

  const bucketMap = new Map<number, number[]>();

  for (const sess of runs) {
    const bucketIndex = Math.floor(sess.sens / bucketSize) * bucketSize;
    const scores = bucketMap.get(bucketIndex) || [];
    scores.push(sess.score);
    bucketMap.set(bucketIndex, scores);
  }

  const buckets: BucketStat[] = [];
  const k = 3; // peso do prior global no encolhimento bayesiano

  for (const [bMin, scores] of bucketMap.entries()) {
    const bMax = bMin + bucketSize;
    const count = scores.length;
    const avg = scores.reduce((a, b) => a + b, 0) / count;
    const max = Math.max(...scores);

    const weightedScore =
      (count / (count + k)) * avg + (k / (count + k)) * globalMeanScore;

    let stdDev: number | null = null;
    let consistency: number | null = null;

    if (count >= 2) {
      const sampleVariance =
        scores.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
        (count - 1);
      stdDev = Math.sqrt(sampleVariance);
      const cv = avg > 0 ? stdDev / avg : 1;
      consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
    }

    let confidenceLevel: "high" | "medium" | "low" | "insufficient";
    if (count >= 8) {
      confidenceLevel = "high";
    } else if (count >= 4) {
      confidenceLevel = "medium";
    } else if (count >= 2) {
      confidenceLevel = "low";
    } else {
      confidenceLevel = "insufficient";
    }

    buckets.push({
      rangeLabel: `${bMin.toFixed(0)} - ${bMax.toFixed(0)} cm`,
      min: bMin,
      max: bMax,
      count,
      avgScore: avg,
      maxScore: max,
      stdDev,
      consistency,
      weightedScore,
      confidenceLevel,
    });
  }

  const maxCountInAnyBucket = Math.max(...buckets.map((b) => b.count), 0);
  const minEligibleRuns =
    maxCountInAnyBucket >= 5 ? 3 : maxCountInAnyBucket >= 3 ? 2 : 1;

  const eligibleBuckets = buckets.filter((b) => b.count >= minEligibleRuns);

  eligibleBuckets.sort((a, b) => {
    if (Math.abs(b.weightedScore - a.weightedScore) > 0.05) {
      return b.weightedScore - a.weightedScore;
    }
    return b.avgScore - a.avgScore;
  });

  buckets.sort((a, b) => {
    if (Math.abs(b.weightedScore - a.weightedScore) > 0.05) {
      return b.weightedScore - a.weightedScore;
    }
    return b.avgScore - a.avgScore;
  });

  const bestBucket = eligibleBuckets[0] || buckets[0] || null;
  const isProvisional = !bestBucket || bestBucket.count < 3;

  return {
    minSens,
    maxSens,
    totalRuns: runs.length,
    bestBucket,
    isProvisional,
    minEligibleRuns,
    buckets,
    globalMeanScore,
  };
}
