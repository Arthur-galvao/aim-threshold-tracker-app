import type { Task } from "./types.ts";
import { latticeIndex } from "./sens-lattice.ts";
import { valorantToCm360 } from "./sens-analytics.ts";
import { binByLattice, kernelSmooth } from "./sens-kernel.ts";

export interface RunPoint {
  taskId: string;
  sessionId: string;
  scenario: string;
  date: string;
  ts: string;           // timestamp formato YYYYMMDDHHmmss
  k: number;            // indice da grade (latticeIndex)
  sens: number;         // cm/360
  score: number;        // score bruto da run (Session.pb)
  rel: number;          // 100 + desvio vs tendencia, em % da mediana
  relReliable: boolean; // false se nao ha runs suficientes pra baseline
  threshold?: number;
}

export const TS_RE = /(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/;

export function runTimestamp(sess: { date: string; sourceFile?: string }): string {
  const m = sess.sourceFile?.match(TS_RE);
  return m ? m.slice(1, 7).join("") : sess.date.replace(/-/g, "") + "000000";
}

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function movingMedian(vals: number[], W: number): number[] {
  const n = vals.length;
  if (n === 0) return [];
  const result: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - W);
    const end = Math.min(n - 1, i + W);
    const windowVals: number[] = [];
    for (let j = start; j <= end; j++) {
      windowVals.push(vals[j]);
    }
    result[i] = computeMedian(windowVals);
  }
  return result;
}

export function buildRunPoints(
  tasks: Task[],
  opts: { dpi: number; trendWindow?: number; window?: number }
): RunPoint[] {
  const windowSize = opts.trendWindow ?? opts.window ?? 10;
  const allPoints: RunPoint[] = [];

  for (const task of tasks) {
    if (!task.sessions || task.sessions.length === 0) continue;

    // Filtra e normaliza sessoes elegiveis mantendo o indice original
    const eligible = task.sessions
      .map((sess, originalIdx) => {
        const cm = valorantToCm360(sess.sens, opts.dpi);
        return {
          sess,
          cm,
          originalIdx,
        };
      })
      .filter((item) => item.cm >= 5 && item.sess.pb > 0);

    if (eligible.length === 0) continue;

    // Ordena por ts crescente (empate: indice original)
    eligible.sort((a, b) => {
      const cmp = runTimestamp(a.sess).localeCompare(runTimestamp(b.sess));
      if (cmp !== 0) return cmp;
      return a.originalIdx - b.originalIdx;
    });

    const totalRuns = eligible.length;
    const sc = eligible.map((item) => Number(item.sess.pb) || 0);
    const k = eligible.map((item) => latticeIndex(item.cm));

    // Identificabilidade: o que separa tendencia de sens sao as transicoes e os retornos (ex.: 50 para 68 e de volta para 50). Cenarios com um unico bloco de sens nao possuem informacao para separar efeito de sens de tendencia, sendo tratados com relReliable=false.
    const distinctK = new Set(k).size;
    const isReliable = totalRuns >= 12 && distinctK >= 3;

    const medianSc = computeMedian(sc);
    let trend: number[] = [];

    if (isReliable) {
      trend = movingMedian(sc, windowSize);
      for (let iter = 0; iter < 12; iter++) {
        const residuals = sc.map((scoreVal, idx) => ({ k: k[idx], rel: scoreVal - trend[idx] }));
        const bins = binByLattice(residuals);
        const evalSmooth = kernelSmooth(bins, 1.5);
        const fVals = k.map((kIdx) => evalSmooth(kIdx));
        const meanF = fVals.reduce((sum, v) => sum + v, 0) / fVals.length;
        const centeredF = fVals.map((v) => v - meanF);
        const detrendedForTrend = sc.map((scoreVal, idx) => scoreVal - centeredF[idx]);
        trend = movingMedian(detrendedForTrend, windowSize);
      }
    }

    for (let i = 0; i < totalRuns; i++) {
      const current = eligible[i];
      const currentScore = sc[i];
      let rel: number;
      let relReliable: boolean;

      if (!isReliable) {
        rel = medianSc > 0 ? Number(((currentScore / medianSc) * 100).toFixed(2)) : 100;
        relReliable = false;
      } else {
        relReliable = true;
        const y = currentScore - trend[i];
        rel = medianSc > 0 ? Number((100 + (y / medianSc) * 100).toFixed(2)) : 100;
      }

      const point: RunPoint = {
        taskId: task.id,
        sessionId: current.sess.id,
        scenario: task.name,
        date: current.sess.date,
        ts: runTimestamp(current.sess),
        k: k[i],
        sens: current.cm,
        score: currentScore,
        rel,
        relReliable,
        threshold: current.sess.threshold,
      };

      allPoints.push(point);
    }
  }

  // Ordena globalmente por ts crescente
  allPoints.sort((a, b) => a.ts.localeCompare(b.ts));

  return allPoints;
}
