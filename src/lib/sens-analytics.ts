export interface BucketStat {
  sens: number;
  label: string;
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

export type PredictorProfile = "equilibrado" | "neutro" | "teorico" | "consistencia";

export interface PredictorProfileConfig {
  id: PredictorProfile;
  labelKey: string;
  descKey: string;
  teoricoWeight: number;
  consistenciaWeight: number;
}

export const PREDICTOR_PROFILES: Record<PredictorProfile, PredictorProfileConfig> = {
  equilibrado: {
    id: "equilibrado",
    labelKey: "randomizer.profileBalanced",
    descKey: "randomizer.profileBalancedDesc",
    teoricoWeight: 0.6,
    consistenciaWeight: 0.4,
  },
  neutro: {
    id: "neutro",
    labelKey: "randomizer.profileNeutral",
    descKey: "randomizer.profileNeutralDesc",
    teoricoWeight: 0.5,
    consistenciaWeight: 0.5,
  },
  teorico: {
    id: "teorico",
    labelKey: "randomizer.profileTheoretical",
    descKey: "randomizer.profileTheoreticalDesc",
    teoricoWeight: 0.7,
    consistenciaWeight: 0.3,
  },
  consistencia: {
    id: "consistencia",
    labelKey: "randomizer.profileConsistency",
    descKey: "randomizer.profileConsistencyDesc",
    teoricoWeight: 0.3,
    consistenciaWeight: 0.7,
  },
};

export interface SensPrediction {
  predictedSens: number;
  label: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  basis: "curvature_blend" | "empirical_best";
  vertexSens: number | null;
  empiricalSens: number;
  scoreEstimate: number | null;
  profile: PredictorProfile;
  teoricoWeight: number;
  consistenciaWeight: number;
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
 * 1. Agrupamento por sensibilidade especifica (arredondada para 1 casa decimal).
 * 2. Encolhimento Bayesiano empirico (k=3) para mitigar distorcoes de amostra pequena.
 * 3. Variancia amostral com correcao de Bessel (n-1).
 * 4. Atribuicao de confianca estatistica (Alta, Media, Baixa, Insuficiente).
 * 5. Selecao da melhor sensibilidade baseada no score ponderado Bayesiano.
 */
export function computeSweetSpotAnalytics(
  runs: RunDataPoint[]
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
    const sensKey = Number(sess.sens.toFixed(1));
    const scores = bucketMap.get(sensKey) || [];
    scores.push(sess.score);
    bucketMap.set(sensKey, scores);
  }

  const buckets: BucketStat[] = [];
  const k = 3; // peso do prior global no encolhimento bayesiano

  for (const [sensKey, scores] of bucketMap.entries()) {
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

    const formattedLabel = formatSensitivity(sensKey);

    buckets.push({
      sens: sensKey,
      label: formattedLabel,
      rangeLabel: formattedLabel,
      min: sensKey,
      max: sensKey,
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

export interface CategoryRunPoint extends RunDataPoint {
  taskId: string;
}

/**
 * Junta os runs de todas as tasks que compartilham categoria e subcategoria.
 */
export function poolCategoryRuns(
  runsByTask: Record<string, CategoryRunPoint[]>
): CategoryRunPoint[] {
  return Object.values(runsByTask).flat();
}

/**
 * Peso exponencial por idade do run. halfLifeDays=60 significa que um run de 60 dias atras
 * pesa metade de um run de hoje. halfLifeDays <= 0 ou dateIso omitido desativa o decaimento.
 */
export function recencyWeight(
  dateIso: string | undefined,
  now: number,
  halfLifeDays: number
): number {
  if (!dateIso || !halfLifeDays || halfLifeDays <= 0) return 1;
  const time = new Date(dateIso).getTime();
  if (isNaN(time)) return 1;
  const ageDays = (now - time) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Ajusta os coeficientes a, b, c da parabola ponderada y = ax^2 + bx + c
 * utilizando minimos quadrados ponderados e regra de Cramer.
 */
export function fitWeightedParabolaCoefficients(
  points: Array<{ x: number; y: number; weight?: number }>
): { a: number; b: number; c: number; vertex: number | null } | null {
  if (points.length < 4) return null;
  const sorted = [...points].sort((p1, p2) => p1.x - p2.x);
  const xMin = sorted[0].x;
  const xMax = sorted[sorted.length - 1].x;
  if (xMax - xMin < 0.1) return null;

  let sumW = 0;
  let sumWX = 0;
  let sumWX2 = 0;
  let sumWX3 = 0;
  let sumWX4 = 0;
  let sumWY = 0;
  let sumWXY = 0;
  let sumWX2Y = 0;

  for (const pt of sorted) {
    const w = typeof pt.weight === "number" ? pt.weight : 1;
    const x = pt.x;
    const y = pt.y;

    sumW += w;
    sumWX += w * x;
    sumWX2 += w * x * x;
    sumWX3 += w * x * x * x;
    sumWX4 += w * x * x * x * x;
    sumWY += w * y;
    sumWXY += w * x * y;
    sumWX2Y += w * x * x * y;
  }

  const d =
    sumW * (sumWX2 * sumWX4 - sumWX3 * sumWX3) -
    sumWX * (sumWX * sumWX4 - sumWX2 * sumWX3) +
    sumWX2 * (sumWX * sumWX3 - sumWX2 * sumWX2);

  if (Math.abs(d) <= 1e-7) return null;

  const da =
    sumWY * (sumWX2 * sumWX4 - sumWX3 * sumWX3) -
    sumWX * (sumWXY * sumWX4 - sumWX2Y * sumWX3) +
    sumWX2 * (sumWXY * sumWX3 - sumWX2Y * sumWX2);
  const db =
    sumW * (sumWXY * sumWX4 - sumWX2Y * sumWX3) -
    sumWY * (sumWX * sumWX4 - sumWX2 * sumWX3) +
    sumWX2 * (sumWX * sumWX2Y - sumWX2 * sumWXY);
  const dc =
    sumW * (sumWX2 * sumWX2Y - sumWX3 * sumWXY) -
    sumWX * (sumWX * sumWX2Y - sumWX2 * sumWXY) +
    sumWY * (sumWX * sumWX3 - sumWX2 * sumWX2);

  const c = da / d;
  const b = db / d;
  const a = dc / d;

  let vertex: number | null = null;
  // Parabola concava para baixo (a < 0) possui ponto maximo
  if (a < -1e-6) {
    const v = -b / (2 * a);
    if (v >= xMin * 0.8 && v <= xMax * 1.2) {
      vertex = Number(v.toFixed(1));
    }
  }

  return { a, b, c, vertex };
}

/**
 * Ajusta os coeficientes a, b, c da parabola y = ax^2 + bx + c e calcula o vertice se for concava (pico maximo).
 * Wrapper de retrocompatibilidade para fitWeightedParabolaCoefficients com pesos uniformes.
 */
export function fitParabolaCoefficients(
  points: Array<{ x: number; y: number }>
): { a: number; b: number; c: number; vertex: number | null } | null {
  return fitWeightedParabolaCoefficients(points);
}

export interface HierarchicalOptions {
  groupRuns?: RunDataPoint[];
  shrinkageK?: number;
  recencyHalfLifeDays?: number;
  now?: number;
}

/**
 * Preditor de sensibilidade ideal.
 * Combina o vertice da curva de dispersao quadratica com o ponto otimo bayesiano empirico
 * de acordo com o perfil de ponderacao e suporta blend hierarquico com o grupo da categoria.
 */
export function predictOptimalSensitivity(
  runs: RunDataPoint[],
  profile: PredictorProfile = "equilibrado",
  options: HierarchicalOptions = {}
): SensPrediction | null {
  const hasLocal = runs && runs.length > 0;
  const groupRuns = options.groupRuns;
  const hasGroup = groupRuns && groupRuns.length > 0;

  if (!hasLocal && !hasGroup) return null;

  const halfLife = options.recencyHalfLifeDays ?? 60;
  const now = options.now ?? Date.now();

  const evaluateSingleSet = (dataPoints: RunDataPoint[]): SensPrediction | null => {
    if (!dataPoints || dataPoints.length === 0) return null;
    const sweetSpot = computeSweetSpotAnalytics(dataPoints);
    const empiricalBest = sweetSpot?.bestBucket?.sens ?? dataPoints[0].sens;

    const points = dataPoints.map((r) => ({
      x: valorantToCm360(r.sens),
      y: r.score,
      weight: halfLife > 0 ? recencyWeight(r.date, now, halfLife) : 1,
    }));

    const parabola = fitWeightedParabolaCoefficients(points);
    const total = dataPoints.length;

    let confidence: "high" | "medium" | "low" | "insufficient";
    if (total >= 20) {
      confidence = "high";
    } else if (total >= 10) {
      confidence = "medium";
    } else if (total >= 5) {
      confidence = "low";
    } else {
      confidence = "insufficient";
    }

    const profileConfig = PREDICTOR_PROFILES[profile] ?? PREDICTOR_PROFILES.equilibrado;
    const { teoricoWeight, consistenciaWeight } = profileConfig;

    let predicted: number;
    let basis: "curvature_blend" | "empirical_best";
    const vertexSens: number | null = parabola?.vertex ?? null;
    let scoreEstimate: number | null = null;

    if (parabola && vertexSens !== null) {
      predicted = Number((teoricoWeight * vertexSens + consistenciaWeight * empiricalBest).toFixed(1));
      basis = "curvature_blend";
      scoreEstimate = Math.round(parabola.a * predicted * predicted + parabola.b * predicted + parabola.c);
    } else {
      predicted = Number(empiricalBest.toFixed(1));
      basis = "empirical_best";
      scoreEstimate = sweetSpot?.bestBucket?.avgScore ? Math.round(sweetSpot.bestBucket.avgScore) : null;
    }

    return {
      predictedSens: predicted,
      label: formatSensitivity(predicted),
      confidence,
      basis,
      vertexSens,
      empiricalSens: Number(empiricalBest.toFixed(1)),
      scoreEstimate,
      profile,
      teoricoWeight,
      consistenciaWeight,
    };
  };

  if (!hasLocal) {
    if (!groupRuns) return null;
    return evaluateSingleSet(groupRuns);
  }

  const localPred = evaluateSingleSet(runs);
  if (!localPred) return null;

  if (groupRuns && groupRuns.length > 0) {
    const distinctSens = new Set(
      groupRuns.map((r) => Number(valorantToCm360(r.sens).toFixed(1)))
    );
    if (distinctSens.size >= 4) {
      const groupPred = evaluateSingleSet(groupRuns);
      if (groupPred) {
        const n_local = runs.length;
        const k = typeof options.shrinkageK === "number" ? options.shrinkageK : 6;
        const peso_local = n_local + k > 0 ? n_local / (n_local + k) : 1;
        const blendedSens = Number(
          (peso_local * localPred.predictedSens + (1 - peso_local) * groupPred.predictedSens).toFixed(1)
        );

        let blendedConfidence = localPred.confidence;
        if (groupRuns.length > n_local && groupPred.confidence !== "insufficient") {
          const confidenceLevels: Array<SensPrediction["confidence"]> = [
            "insufficient",
            "low",
            "medium",
            "high",
          ];
          const currentIndex = confidenceLevels.indexOf(localPred.confidence);
          if (currentIndex < confidenceLevels.length - 1) {
            blendedConfidence = confidenceLevels[currentIndex + 1];
          }
        }

        const basis =
          localPred.basis === "curvature_blend" || groupPred.basis === "curvature_blend"
            ? "curvature_blend"
            : "empirical_best";

        return {
          ...localPred,
          predictedSens: blendedSens,
          label: formatSensitivity(blendedSens),
          confidence: blendedConfidence,
          basis,
          vertexSens: localPred.vertexSens ?? groupPred.vertexSens,
        };
      }
    }
  }

  return localPred;
}
