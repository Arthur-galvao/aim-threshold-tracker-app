import type { Task } from "./types.ts";
import { latticeIndex } from "./sens-lattice.ts";
import { valorantToCm360 } from "./sens-analytics.ts";

export interface RunPoint {
  taskId: string;
  sessionId: string;
  scenario: string;
  date: string;
  k: number;            // indice da grade (latticeIndex)
  sens: number;         // cm/360
  score: number;        // score bruto da run (Session.pb)
  rel: number;          // desempenho relativo ao baseline do cenario, 100 = tipico
  relReliable: boolean; // false se nao ha runs suficientes pra baseline
  threshold?: number;
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

export function buildRunPoints(
  tasks: Task[],
  opts: { dpi: number; window?: number }
): RunPoint[] {
  const windowSize = opts.window ?? 8;
  const allPoints: RunPoint[] = [];

  for (const task of tasks) {
    if (!task.sessions || task.sessions.length === 0) continue;

    // Filtra e normaliza sessoes elegíveis mantendo o índice original
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

    // Ordena por date crescente (empate: índice original)
    eligible.sort((a, b) => {
      const cmp = a.sess.date.localeCompare(b.sess.date);
      if (cmp !== 0) return cmp;
      return a.originalIdx - b.originalIdx;
    });

    const totalRuns = eligible.length;

    for (let i = 0; i < totalRuns; i++) {
      const current = eligible[i];
      const currentScore = Number(current.sess.pb) || 0;

      // Vizinhos em +- windowSize posições, excluindo i
      const start = Math.max(0, i - windowSize);
      const end = Math.min(totalRuns - 1, i + windowSize);

      const neighborScores: number[] = [];
      for (let j = start; j <= end; j++) {
        if (j !== i) {
          neighborScores.push(Number(eligible[j].sess.pb) || 0);
        }
      }

      let baseline = 0;
      let relReliable = true;

      if (neighborScores.length >= 6) {
        baseline = computeMedian(neighborScores);
      } else {
        // Se menos de 6 vizinhos, usa todas as outras runs se >= 3
        const allOtherScores: number[] = [];
        for (let j = 0; j < totalRuns; j++) {
          if (j !== i) {
            allOtherScores.push(Number(eligible[j].sess.pb) || 0);
          }
        }

        if (allOtherScores.length >= 3) {
          baseline = computeMedian(allOtherScores);
        } else {
          baseline = currentScore;
          relReliable = false;
        }
      }

      let rel = 100;
      if (baseline > 0 && relReliable) {
        rel = (currentScore / baseline) * 100;
      } else {
        rel = 100;
        relReliable = false;
      }

      const point: RunPoint = {
        taskId: task.id,
        sessionId: current.sess.id,
        scenario: task.name,
        date: current.sess.date,
        k: latticeIndex(current.cm),
        sens: current.cm,
        score: currentScore,
        rel: Number(rel.toFixed(2)),
        relReliable,
        threshold: current.sess.threshold,
      };

      allPoints.push(point);
    }
  }

  // Ordena globalmente por data crescente (estável para ordem original em empate)
  allPoints.sort((a, b) => a.date.localeCompare(b.date));

  return allPoints;
}
