export {
  type BinStat,
  binByLattice,
  kernelSmooth,
  kernelSupport,
} from "./sens-kernel.ts";

export interface QuadFit {
  a: number;
  b: number;
  c: number;
  vertexCm: number | null;
  r2: number;
  refCm: number;
}

function solve3x3GaussJordan(A: number[][], b: number[]): [number, number, number] | null {
  const M = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];

  for (let col = 0; col < 3; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < 3; r++) {
      const val = Math.abs(M[r][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) return null;

    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= 3; j++) {
      M[col][j] /= pivot;
    }

    for (let r = 0; r < 3; r++) {
      if (r !== col) {
        const factor = M[r][col];
        for (let j = col; j <= 3; j++) {
          M[r][j] -= factor * M[col][j];
        }
      }
    }
  }

  return [M[0][3], M[1][3], M[2][3]];
}

/**
 * Ajusta parabola y = a * u^2 + b * u + c onde u = ln(cm / ref).
 * Retorna null a menos que cumpra todos os criterios de robustez estatistica.
 */
export function fitQuadraticLog(
  pts: Array<{ cm: number; y: number; w?: number }>
): QuadFit | null {
  if (!pts || pts.length < 12) return null;

  const validPts = pts.filter((p) => p.cm > 0 && !isNaN(p.cm) && !isNaN(p.y));
  if (validPts.length < 12) return null;

  const distinctCm = new Set(validPts.map((p) => Number(p.cm.toFixed(1))));
  if (distinctCm.size < 5) return null;

  let sumW = 0;
  let sumWlnCm = 0;
  for (const p of validPts) {
    const w = typeof p.w === "number" && p.w > 0 ? p.w : 1;
    sumW += w;
    sumWlnCm += w * Math.log(p.cm);
  }
  if (sumW <= 0) return null;

  const ref = Math.exp(sumWlnCm / sumW);

  const uVals = validPts.map((p) => Math.log(p.cm / ref));
  const uMin = Math.min(...uVals);
  const uMax = Math.max(...uVals);

  // Amplitude em u >= ln(1.25)
  if (uMax - uMin < Math.log(1.25)) return null;

  let sumWu2 = 0;
  for (let i = 0; i < validPts.length; i++) {
    const w = typeof validPts[i].w === "number" && validPts[i].w! > 0 ? validPts[i].w! : 1;
    sumWu2 += w * uVals[i] * uVals[i];
  }
  const sdU = Math.sqrt(sumWu2 / sumW);
  if (sdU < 1e-6) return null;

  // z_i = u_i / sdU
  const zVals = uVals.map((u) => u / sdU);

  let sW = 0;
  let sZ = 0;
  let sZ2 = 0;
  let sZ3 = 0;
  let sZ4 = 0;
  let sY = 0;
  let sZY = 0;
  let sZ2Y = 0;

  for (let i = 0; i < validPts.length; i++) {
    const w = typeof validPts[i].w === "number" && validPts[i].w! > 0 ? validPts[i].w! : 1;
    const z = zVals[i];
    const y = validPts[i].y;

    sW += w;
    sZ += w * z;
    sZ2 += w * z * z;
    sZ3 += w * z * z * z;
    sZ4 += w * z * z * z * z;
    sY += w * y;
    sZY += w * z * y;
    sZ2Y += w * z * z * y;
  }

  const A = [
    [sW, sZ, sZ2],
    [sZ, sZ2, sZ3],
    [sZ2, sZ3, sZ4],
  ];
  const b = [sY, sZY, sZ2Y];

  const sol = solve3x3GaussJordan(A, b);
  if (!sol) return null;

  const [cz, bz, az] = sol;

  // Desescalar para u: y = a_u * u^2 + b_u * u + c_u
  const a = az / (sdU * sdU);
  const b_coef = bz / sdU;
  const c = cz;

  // Exigir a < 0 (concava com maximo)
  if (a >= 0) return null;

  const uVertex = -b_coef / (2 * a);

  // Vertice precisa estar dentro de [uMin, uMax] (sem extrapolacao)
  if (uVertex < uMin || uVertex > uMax) return null;

  const vertexCm = Number((ref * Math.exp(uVertex)).toFixed(2));

  // Coeficiente de determinacao R^2
  const meanY = sY / sW;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < validPts.length; i++) {
    const w = typeof validPts[i].w === "number" && validPts[i].w! > 0 ? validPts[i].w! : 1;
    const u = uVals[i];
    const y = validPts[i].y;
    const yPred = a * u * u + b_coef * u + c;

    ssTot += w * Math.pow(y - meanY, 2);
    ssRes += w * Math.pow(y - yPred, 2);
  }

  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    a,
    b: b_coef,
    c,
    vertexCm,
    r2: Number(r2.toFixed(4)),
    refCm: ref,
  };
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap parametrico do vertice para calcular intervalo de confianca (percentis 10 e 90).
 */
export function bootstrapVertex(
  pts: Array<{ cm: number; y: number; w?: number }>,
  opts?: { b?: number; seed?: number }
): { low: number; high: number; validFraction: number } | null {
  if (!pts || pts.length < 12) return null;

  const B = opts?.b ?? 300;
  const rng = mulberry32(opts?.seed ?? 42);

  const n = pts.length;
  const validVertices: number[] = [];

  for (let iter = 0; iter < B; iter++) {
    const sample: Array<{ cm: number; y: number; w?: number }> = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      sample.push(pts[idx]);
    }

    const fit = fitQuadraticLog(sample);
    if (fit && fit.vertexCm !== null) {
      validVertices.push(fit.vertexCm);
    }
  }

  const validFraction = validVertices.length / B;
  if (validFraction < 0.6) return null;

  validVertices.sort((a, b) => a - b);
  const m = validVertices.length;

  const lowIdx = Math.floor(0.1 * (m - 1));
  const highIdx = Math.ceil(0.9 * (m - 1));

  return {
    low: Number(validVertices[lowIdx].toFixed(2)),
    high: Number(validVertices[highIdx].toFixed(2)),
    validFraction: Number(validFraction.toFixed(4)),
  };
}
