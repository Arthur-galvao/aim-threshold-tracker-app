import type { Playlist, Task } from "./types.ts";
import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY, getRecommendedSens } from "./viscose.ts";
import { buildRunPoints } from "./run-points.ts";
import { latticeCm, latticeIndex } from "./sens-lattice.ts";
import {
  binByLattice,
  kernelSmooth,
  fitQuadraticLog,
  bootstrapVertex,
  type BinStat,
  type QuadFit,
} from "./sens-model.ts";

export {
  binByLattice,
  kernelSmooth,
  fitQuadraticLog,
  bootstrapVertex,
  type BinStat,
  type QuadFit,
};

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
  wParam: number;
  lambda: number;
  teoricoWeight: number;
  consistenciaWeight: number;
}

export const PREDICTOR_PROFILES: Record<PredictorProfile, PredictorProfileConfig> = {
  equilibrado: {
    id: "equilibrado",
    labelKey: "randomizer.profileBalanced",
    descKey: "randomizer.profileBalancedDesc",
    wParam: 0.5,
    lambda: 0.25,
    teoricoWeight: 0.5,
    consistenciaWeight: 0.5,
  },
  neutro: {
    id: "neutro",
    labelKey: "randomizer.profileNeutral",
    descKey: "randomizer.profileNeutralDesc",
    wParam: 0.5,
    lambda: 0.0,
    teoricoWeight: 0.5,
    consistenciaWeight: 0.5,
  },
  teorico: {
    id: "teorico",
    labelKey: "randomizer.profileTheoretical",
    descKey: "randomizer.profileTheoreticalDesc",
    wParam: 0.8,
    lambda: 0.0,
    teoricoWeight: 0.8,
    consistenciaWeight: 0.2,
  },
  consistencia: {
    id: "consistencia",
    labelKey: "randomizer.profileConsistency",
    descKey: "randomizer.profileConsistencyDesc",
    wParam: 0.3,
    lambda: 1.0,
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
  wParam?: number;
  lambda?: number;
  ci?: { low: number | null; high: number | null };
  reasons?: string[];
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
export function valorantToCm360(sens: number, dpi: number): number {
  if (sens <= 0) return sens;
  if (sens < 2.5) {
    const yaw = 0.07;
    // Formula fisica: (360 graus * 2.54 cm/pol) / (yaw * sens * dpi contagens/pol)
    return Number(((360 * 2.54) / (yaw * dpi * sens)).toFixed(1));
  }
  return sens;
}

/**
 * Converte cm/360 físico para a sensibilidade angular equivalente no Valorant para um dado DPI.
 */
export function cm360ToValorant(cm: number, dpi: number): number {
  if (cm <= 0 || dpi <= 0) return 0;
  const yaw = 0.07;
  // cm = (360 * 2.54) / (yaw * dpi * sens) => sens = (360 * 2.54) / (yaw * dpi * cm)
  return Number(((360 * 2.54) / (yaw * dpi * cm)).toFixed(3));
}

/**
 * Converte cm/360 físico para a sensibilidade angular equivalente em jogos Source/Apex/CS para um dado DPI.
 */
export function cm360ToSource(cm: number, dpi: number): number {
  if (cm <= 0 || dpi <= 0) return 0;
  const yaw = 0.022;
  return Number(((360 * 2.54) / (yaw * dpi * cm)).toFixed(3));
}

/**
 * Formata um valor de sensibilidade para exibicao amigavel com unidade (padrao: cm).
 */
export function formatSensitivity(sens: number, dpi: number, unit: string = "cm"): string {
  if (!sens || sens <= 0) return "-";
  const effectiveSens = valorantToCm360(sens, dpi);
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

export interface SweetSpotOptions {
  binPriorStrength?: number;
  shrinkageK?: number;
  minEligibleRuns?: number;
}

/**
 * Executa analise estatistica de Sweet Spot sobre sessoes de treino:
 * 1. Agrupamento por indice de grade exponencial (sens-lattice).
 * 2. Prior bayesiano de vizinhos (looSmooth) com forca m (padrao 2).
 * 3. Variancia amostral com correcao de Bessel (n-1).
 * 4. Atribuicao de confianca estatistica (Alta, Media, Baixa, Insuficiente).
 * 5. Selecao da melhor sensibilidade com ordenacao deterministica (weightedScore desc, sens desc).
 */
export function computeSweetSpotAnalytics(
  runs: RunDataPoint[],
  options: SweetSpotOptions = {}
): SweetSpotAnalysis | null {
  if (!runs || runs.length === 0) {
    return null;
  }

  const sensList = runs.map((r) => (r.sens >= 2.5 ? r.sens : valorantToCm360(r.sens, 800)));
  const minSens = Math.floor(Math.min(...sensList));
  const maxSens = Math.ceil(Math.max(...sensList));

  const totalScores = runs.map((r) => r.score);
  const globalMeanScore =
    totalScores.reduce((a, b) => a + b, 0) / (totalScores.length || 1);

  const latticePts = runs.map((r) => {
    const cm = r.sens >= 2.5 ? r.sens : valorantToCm360(r.sens, 800);
    return {
      k: latticeIndex(cm),
      rel: r.score,
    };
  });

  const binStats = binByLattice(latticePts);
  const m =
    typeof options.binPriorStrength === "number"
      ? options.binPriorStrength
      : typeof options.shrinkageK === "number"
      ? options.shrinkageK
      : 2;

  const buckets: BucketStat[] = [];

  for (const b of binStats) {
    const count = b.n;
    const avg = b.mean;
    const binScores = runs
      .filter((r) => latticeIndex(r.sens >= 2.5 ? r.sens : valorantToCm360(r.sens, 800)) === b.k)
      .map((r) => r.score);
    const max = binScores.length > 0 ? Math.max(...binScores) : avg;

    const weightedScore = (count * avg + m * b.looSmooth) / (count + m);

    let consistency: number | null = null;
    if (b.sd !== null && count >= 2) {
      const cv = avg > 0 ? b.sd / avg : 1;
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

    const formattedLabel = formatSensitivity(b.cm, 800);

    buckets.push({
      sens: b.cm,
      label: formattedLabel,
      rangeLabel: formattedLabel,
      min: b.cm,
      max: b.cm,
      count,
      avgScore: Number(avg.toFixed(2)),
      maxScore: Number(max.toFixed(2)),
      stdDev: b.sd !== null ? Number(b.sd.toFixed(2)) : null,
      consistency: consistency !== null ? Number(consistency.toFixed(1)) : null,
      weightedScore: Number(weightedScore.toFixed(4)),
      confidenceLevel,
    });
  }

  const hasBinWith2 = buckets.some((b) => b.count >= 2);
  const minEligibleRuns =
    typeof options.minEligibleRuns === "number"
      ? options.minEligibleRuns
      : hasBinWith2
      ? 2
      : 1;

  const eligibleBuckets = buckets.filter((b) => b.count >= minEligibleRuns);

  eligibleBuckets.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return b.sens - a.sens;
  });

  buckets.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return b.sens - a.sens;
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
  const distinctX = new Set(points.map((p) => Number(p.x.toFixed(1))));
  if (distinctX.size < 3) return null;
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
  groupBlendK?: number;
  binPriorStrength?: number;
  minEligibleRuns?: number;
  recencyHalfLifeDays?: number;
  now?: number;
  shrinkageK?: number;
}

/**
 * Preditor de sensibilidade ideal refinado.
 * Combina o vertice da curva quadratica em log (fitQuadraticLog) com o ponto otimo do kernel smoother
 * ponderado pelo perfil estatistico (wParam e lambda) e suporta blend hierarquico em log com o grupo da categoria.
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

  const halfLife = options.recencyHalfLifeDays ?? 0;
  const now = options.now ?? Date.now();

  const evaluateSingleSet = (dataPoints: RunDataPoint[]): SensPrediction | null => {
    if (!dataPoints || dataPoints.length === 0) return null;

    const totalN = dataPoints.length;
    const profileConfig = PREDICTOR_PROFILES[profile] ?? PREDICTOR_PROFILES.equilibrado;
    const { wParam, lambda, teoricoWeight, consistenciaWeight } = profileConfig;

    const pts = dataPoints.map((r) => {
      const cm = r.sens >= 2.5 ? r.sens : valorantToCm360(r.sens, 800);
      const w = halfLife > 0 ? recencyWeight(r.date, now, halfLife) : 1;
      return {
        k: latticeIndex(cm),
        cm,
        rel: r.score,
        w,
      };
    });

    const binStats = binByLattice(pts);
    if (binStats.length === 0) return null;

    let globalSd = 0;
    if (totalN >= 2) {
      const meanScore = pts.reduce((sum, p) => sum + p.rel, 0) / totalN;
      const sqDiff = pts.reduce((sum, p) => sum + Math.pow(p.rel - meanScore, 2), 0);
      globalSd = Math.sqrt(sqDiff / (totalN - 1));
    }

    let bestBin = binStats[0];
    let bestScore = -Infinity;

    for (const b of binStats) {
      const sd_k = b.sd !== null && b.n >= 2 ? b.sd : globalSd;
      const score_k = b.smooth - lambda * sd_k;
      if (score_k > bestScore || (score_k === bestScore && b.cm > bestBin.cm)) {
        bestScore = score_k;
        bestBin = b;
      }
    }

    const kernelBest = bestBin.cm;

    const ptsForFit = pts.map((p) => ({ cm: p.cm, y: p.rel, w: p.w }));
    const quadFit = fitQuadraticLog(ptsForFit);

    let predictedRaw: number;
    let basis: "curvature_blend" | "empirical_best";
    const vertexSens: number | null = quadFit?.vertexCm ?? null;
    let scoreEstimate: number | null = null;

    if (quadFit && vertexSens !== null) {
      predictedRaw = Math.exp(wParam * Math.log(vertexSens) + (1 - wParam) * Math.log(kernelBest));
      basis = "curvature_blend";
      scoreEstimate = Math.round(quadFit.c);
    } else {
      predictedRaw = kernelBest;
      basis = "empirical_best";
      scoreEstimate = Math.round(bestBin.mean);
    }

    const predictedSens = latticeCm(latticeIndex(predictedRaw));

    let ci: { low: number | null; high: number | null } = { low: null, high: null };
    let icWidth = Infinity;

    if (quadFit && vertexSens !== null) {
      const boot = bootstrapVertex(ptsForFit, { b: 150, seed: 42 });
      if (boot) {
        ci = { low: boot.low, high: boot.high };
        icWidth = (boot.high - boot.low) / (predictedSens || 1);
      }
    }

    const distinctBins = binStats.length;
    let confidence: "high" | "medium" | "low" | "insufficient";

    if (totalN >= 30 && distinctBins >= 6 && icWidth <= 0.15) {
      confidence = "high";
    } else if (totalN >= 15 && distinctBins >= 5 && icWidth <= 0.30) {
      confidence = "medium";
    } else if (totalN >= 8 && distinctBins >= 3) {
      confidence = "low";
    } else {
      confidence = "insufficient";
    }

    const reasons: string[] = [];
    if (totalN < 15) {
      reasons.push("randomizer.reasonFewRuns");
    }
    if (distinctBins < 5) {
      reasons.push("randomizer.reasonFewSens");
    }
    if (ci.low === null || icWidth > 0.30) {
      reasons.push("randomizer.reasonWideCi");
    }

    return {
      predictedSens,
      label: formatSensitivity(predictedSens, 800),
      confidence,
      basis,
      vertexSens,
      empiricalSens: kernelBest,
      scoreEstimate,
      profile,
      teoricoWeight,
      consistenciaWeight,
      wParam,
      lambda,
      ci,
      reasons,
    };
  };

  if (!hasLocal) {
    if (!groupRuns) return null;
    return evaluateSingleSet(groupRuns);
  }

  const localPred = evaluateSingleSet(runs);
  if (!localPred) return null;

  if (groupRuns && groupRuns.length > 0) {
    const groupPts = groupRuns.map((r) => {
      const cm = r.sens >= 2.5 ? r.sens : valorantToCm360(r.sens, 800);
      return { k: latticeIndex(cm), rel: r.score };
    });
    const groupBins = binByLattice(groupPts);

    if (groupBins.length >= 4) {
      const groupPred = evaluateSingleSet(groupRuns);
      if (groupPred) {
        const nLocal = runs.length;
        const kBlend =
          typeof options.groupBlendK === "number"
            ? options.groupBlendK
            : typeof options.shrinkageK === "number"
            ? options.shrinkageK
            : 12;
        const wLocal = nLocal / (nLocal + kBlend);

        const blendedRaw = Math.exp(
          wLocal * Math.log(localPred.predictedSens) + (1 - wLocal) * Math.log(groupPred.predictedSens)
        );
        const blendedSens = latticeCm(latticeIndex(blendedRaw));

        let blendedConfidence = localPred.confidence;
        if (groupRuns.length > nLocal && groupPred.confidence !== "insufficient") {
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
          label: formatSensitivity(blendedSens, 800),
          confidence: blendedConfidence,
          basis,
          vertexSens: localPred.vertexSens ?? groupPred.vertexSens,
          ci: localPred.ci?.low !== null ? localPred.ci : groupPred.ci,
        };
      }
    }
  }

  return localPred;
}

export const predictSens = predictOptimalSensitivity;

export interface RecenterSuggestion {
  suggestedCm: number;
  currentCm: number;
  ratio: number;
}

/**
 * Sugere recentralizacao quando ha confianca estatistica (medium/high) e
 * a sensibilidade predita desviou mais de 8% do centro atual (|ln(pred / center)| > ln(1.08)).
 */
export function suggestRecenter(
  prediction: SensPrediction | null | undefined,
  currentCenterCm: number
): RecenterSuggestion | null {
  if (!prediction || (prediction.confidence !== "high" && prediction.confidence !== "medium")) {
    return null;
  }
  if (!currentCenterCm || currentCenterCm <= 0) {
    return null;
  }
  const ratio = prediction.predictedSens / currentCenterCm;
  const drift = Math.abs(Math.log(ratio));
  if (drift > Math.log(1.08)) {
    return {
      suggestedCm: prediction.predictedSens,
      currentCm: currentCenterCm,
      ratio,
    };
  }
  return null;
}

export interface PlaylistCategorySlice {
  category: string;
  subcategory: string;
  scenariosCount: number;
  totalRuns: number;
  displaySens: { value: number; source: "predicted" | "viscose" };
  confidence: "high" | "medium" | "low" | "insufficient";
}

export interface PlaylistSensStats {
  playlistId: string;
  playlistName: string;
  scenariosCount: number;
  totalRuns: number;
  displaySens: { value: number; source: "predicted" | "viscose" };
  overallConfidence: "high" | "medium" | "low" | "insufficient";
  categorySlices: PlaylistCategorySlice[];
  normalizedRuns: RunDataPoint[];
}

export function computePlaylistSensStats(
  playlist: Playlist,
  tasks: Task[],
  profile: PredictorProfile = "equilibrado",
  dpi: number = 800
): PlaylistSensStats {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  const matchedTasks: Task[] = [];
  const seenTaskIds = new Set<string>();

  for (const item of playlist.items || []) {
    const task = taskMap.get(item.taskId);
    if (task && !seenTaskIds.has(task.id)) {
      seenTaskIds.add(task.id);
      matchedTasks.push(task);
    }
  }

  interface SliceBucket {
    category: string;
    subcategory: string;
    scenariosCount: number;
    runs: RunDataPoint[];
  }

  const sliceMap = new Map<string, SliceBucket>();

  for (const task of matchedTasks) {
    const cat = task.category || DEFAULT_CATEGORY;
    const subcat = task.subcategory || DEFAULT_SUBCATEGORY;
    const key = `${cat}__${subcat}`;

    let bucket = sliceMap.get(key);
    if (!bucket) {
      bucket = {
        category: cat,
        subcategory: subcat,
        scenariosCount: 0,
        runs: [],
      };
      sliceMap.set(key, bucket);
    }
    bucket.scenariosCount += 1;
  }

  const runPoints = buildRunPoints(matchedTasks, { dpi });
  const matchedTaskMap = new Map(matchedTasks.map((t) => [t.id, t]));

  const normalizedRuns: RunDataPoint[] = runPoints.map((p) => {
    const task = matchedTaskMap.get(p.taskId);
    const cat = task?.category || DEFAULT_CATEGORY;
    const subcat = task?.subcategory || DEFAULT_SUBCATEGORY;
    const key = `${cat}__${subcat}`;

    const runPoint: RunDataPoint = {
      sens: p.sens,
      score: p.rel,
      rawScore: p.score,
      normScore: p.rel,
      scenario: p.scenario,
      date: p.date,
      threshold: p.threshold,
    };

    const bucket = sliceMap.get(key);
    if (bucket) {
      bucket.runs.push(runPoint);
    }
    return runPoint;
  });

  const categorySlices: PlaylistCategorySlice[] = [];

  for (const bucket of sliceMap.values()) {
    const sliceRuns = bucket.runs;
    const totalRuns = sliceRuns.length;

    let displaySens: { value: number; source: "predicted" | "viscose" };
    let confidence: "high" | "medium" | "low" | "insufficient" = "insufficient";

    if (totalRuns >= 8) {
      const slicePred = predictOptimalSensitivity([], profile, { groupRuns: sliceRuns });
      if (slicePred && slicePred.confidence !== "insufficient") {
        displaySens = { value: slicePred.predictedSens, source: "predicted" };
        confidence = slicePred.confidence;
      } else {
        const fallback = getRecommendedSens(bucket.category, bucket.subcategory) ?? 45;
        displaySens = { value: fallback, source: "viscose" };
        confidence = slicePred?.confidence ?? "insufficient";
      }
    } else {
      const fallback = getRecommendedSens(bucket.category, bucket.subcategory) ?? 45;
      displaySens = { value: fallback, source: "viscose" };
      if (totalRuns >= 5) {
        confidence = "low";
      } else {
        confidence = "insufficient";
      }
    }

    categorySlices.push({
      category: bucket.category,
      subcategory: bucket.subcategory,
      scenariosCount: bucket.scenariosCount,
      totalRuns,
      displaySens,
      confidence,
    });
  }

  categorySlices.sort((a, b) => {
    if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
    if (b.scenariosCount !== a.scenariosCount) return b.scenariosCount - a.scenariosCount;
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return a.subcategory.localeCompare(b.subcategory);
  });

  let overallDisplaySens: { value: number; source: "predicted" | "viscose" } | null = null;
  let overallConfidence: "high" | "medium" | "low" | "insufficient" = "insufficient";

  const totalRuns = normalizedRuns.length;
  if (totalRuns >= 8) {
    const distinctSens = new Set(
      normalizedRuns.map((r) =>
        r.sens >= 2.5
          ? Number(r.sens.toFixed(1))
          : Number(valorantToCm360(r.sens, dpi).toFixed(1))
      )
    );

    if (distinctSens.size >= 4) {
      const overallPred = predictOptimalSensitivity([], profile, { groupRuns: normalizedRuns });
      if (overallPred && overallPred.confidence !== "insufficient") {
        overallDisplaySens = { value: overallPred.predictedSens, source: "predicted" };
        overallConfidence = overallPred.confidence;
      }
    }
  }

  if (!overallDisplaySens) {
    let fallbackValue = 45;

    if (categorySlices.length > 0) {
      const totalRunsSum = categorySlices.reduce((sum, s) => sum + s.totalRuns, 0);
      if (totalRunsSum > 0) {
        const weightedSum = categorySlices.reduce(
          (sum, s) => sum + s.displaySens.value * s.totalRuns,
          0
        );
        fallbackValue = Number((weightedSum / totalRunsSum).toFixed(1));
      } else {
        const totalScenariosSum = categorySlices.reduce(
          (sum, s) => sum + s.scenariosCount,
          0
        );
        if (totalScenariosSum > 0) {
          const weightedSum = categorySlices.reduce(
            (sum, s) => sum + s.displaySens.value * s.scenariosCount,
            0
          );
          fallbackValue = Number((weightedSum / totalScenariosSum).toFixed(1));
        } else {
          fallbackValue = categorySlices[0].displaySens.value;
        }
      }
    }

    overallDisplaySens = { value: fallbackValue, source: "viscose" };
    overallConfidence = "insufficient";
  }

  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    scenariosCount: matchedTasks.length,
    totalRuns,
    displaySens: overallDisplaySens,
    overallConfidence,
    categorySlices,
    normalizedRuns,
  };
}

export interface ScenarioIdealSens {
  value: number;
  source: "empirical" | "viscose";
  confidence: "high" | "medium" | "low" | "insufficient";
  count: number;
  viscoseSens: number;
  empiricalSens: number | null;
  scenarioName?: string;
}

/**
 * Determina a sensibilidade ideal para um cenario:
 * 1. Se houver >= 3 runs elegiveis (sens >= 5cm, score > 0) em um sweet spot Bayesiano estavel: adota o pico empirico.
 * 2. Se houver falta de dados no cenario, mas a categoria possuir >= 8 runs agrupadas em allTasks: herda o pico da categoria.
 * 3. Caso contrario (falta de dados geral): recorre a recomendacao estatica da Viscose.
 */
export function getScenarioIdealSens(
  task: Task | null | undefined,
  allTasks: Task[] | undefined,
  dpi: number
): ScenarioIdealSens {
  const category = task?.category || DEFAULT_CATEGORY;
  const subcategory = task?.subcategory || DEFAULT_SUBCATEGORY;
  const viscoseSens =
    getRecommendedSens(category, subcategory) ??
    getRecommendedSens(DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY) ??
    45;

  if (!task || !task.sessions || task.sessions.length === 0) {
    return {
      value: viscoseSens,
      source: "viscose",
      confidence: "insufficient",
      count: 0,
      viscoseSens,
      empiricalSens: null,
      scenarioName: task?.name,
    };
  }

  // Coleta runs elegiveis do cenario via buildRunPoints
  const runPoints = buildRunPoints([task], { dpi });
  const taskRuns: RunDataPoint[] = runPoints.map((p) => ({
    sens: p.sens,
    score: p.score,
    rawScore: p.score,
    normScore: p.rel,
    date: p.date,
    scenario: p.scenario,
    threshold: p.threshold,
  }));

  // Tentativa 1: Preditor local do cenario (confidence medium ou high)
  if (taskRuns.length >= 3) {
    const localPred = predictOptimalSensitivity(taskRuns);
    if (localPred && (localPred.confidence === "high" || localPred.confidence === "medium")) {
      return {
        value: localPred.predictedSens,
        source: "empirical",
        confidence: localPred.confidence,
        count: taskRuns.length,
        viscoseSens,
        empiricalSens: localPred.predictedSens,
        scenarioName: task.name,
      };
    }
  }

  // Tentativa 2: Agrupamento da categoria se allTasks fornecido e local insuficiente
  if (allTasks && allTasks.length > 0) {
    const categoryTasks = allTasks.filter(
      (t) =>
        (t.category || DEFAULT_CATEGORY) === category &&
        (t.subcategory || DEFAULT_SUBCATEGORY) === subcategory
    );
    const categoryRunPoints = buildRunPoints(categoryTasks, { dpi });
    const groupRuns: RunDataPoint[] = categoryRunPoints.map((p) => ({
      sens: p.sens,
      score: p.rel, // pooled rel score (item 2: pooling usa rel)
      rawScore: p.score,
      normScore: p.rel,
      date: p.date,
      scenario: p.scenario,
      threshold: p.threshold,
    }));

    if (groupRuns.length >= 8) {
      const pred = predictOptimalSensitivity(groupRuns);
      if (pred && (pred.confidence === "high" || pred.confidence === "medium")) {
        return {
          value: pred.predictedSens,
          source: "empirical",
          confidence: pred.confidence,
          count: groupRuns.length,
          viscoseSens,
          empiricalSens: pred.predictedSens,
          scenarioName: task.name,
        };
      }
    }
  }

  // Fallback por falta de dados: Viscose Benchmark
  return {
    value: viscoseSens,
    source: "viscose",
    confidence: taskRuns.length >= 2 ? "low" : "insufficient",
    count: taskRuns.length,
    viscoseSens,
    empiricalSens: null,
    scenarioName: task.name,
  };
}

