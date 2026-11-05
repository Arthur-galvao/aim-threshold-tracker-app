import { sessionKey, type RunRef } from "./sessions.ts";
import { theilSenSlope } from "./stats.ts";

/**
 * Qualidade além do score (Plano 07, T7.9).
 * Por cenário e por sessão: média de score (pb), accuracy (0..1) e avgTtk.
 * Tendências de accuracy e TTK = Theil-Sen sobre as médias por sessão (x = índice da sessão do cenário).
 */

/** Mínimo de sessões com valor para estimar tendência. */
export const QUALITY_MIN_POINTS = 3;
/** Queda de accuracy (fração, 0.03 = 3 p.p.) necessária para o flag de piloto automático. */
export const AUTOPILOT_ACCURACY_DROP = 0.03;
/** Janela do flag: média das 2 últimas vs média das 2 anteriores. */
export const AUTOPILOT_WINDOW = 2;

export interface SessionQualityPoint {
  sessionKey: string;
  score: number;
  accuracy: number | null;
  ttk: number | null;
}

export interface ScenarioQuality {
  taskId: string;
  /** Sessões em que o cenário foi treinado, cronológicas. */
  series: SessionQualityPoint[];
  /** Variação de accuracy por sessão (Theil-Sen); null com menos de QUALITY_MIN_POINTS valores. */
  accuracySlope: number | null;
  /** Variação de TTK por sessão (Theil-Sen); null com menos de QUALITY_MIN_POINTS valores. */
  ttkSlope: number | null;
  possibleAutopilot: boolean;
}

function finiteMean(xs: Array<number | undefined | null>): number | null {
  const vals = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (vals.length === 0) return null;
  return vals.reduce((acc, x) => acc + x, 0) / vals.length;
}

/**
 * @param taskId cenário
 * @param sessions sessões globais (saída de `groupTrainingSessions`), cronológicas
 */
export function scenarioQuality(taskId: string, sessions: RunRef[][]): ScenarioQuality {
  const series: SessionQualityPoint[] = [];
  for (const group of sessions) {
    const runs = group.filter((r) => r.taskId === taskId);
    if (runs.length === 0) continue;
    series.push({
      sessionKey: sessionKey(group),
      score: finiteMean(runs.map((r) => r.session.pb)) ?? 0,
      accuracy: finiteMean(runs.map((r) => r.session.accuracy)),
      ttk: finiteMean(runs.map((r) => r.session.avgTtk)),
    });
  }

  return {
    taskId,
    series,
    accuracySlope: trendSlope(series, (p) => p.accuracy),
    ttkSlope: trendSlope(series, (p) => p.ttk),
    possibleAutopilot: possibleAutopilot(series),
  };
}

function trendSlope(series: SessionQualityPoint[], pick: (p: SessionQualityPoint) => number | null): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  series.forEach((p, i) => {
    const v = pick(p);
    if (v !== null) {
      xs.push(i);
      ys.push(v);
    }
  });
  if (ys.length < QUALITY_MIN_POINTS) return null;
  return theilSenSlope(xs, ys);
}

/**
 * Score subiu e accuracy caiu > 3 p.p. comparando as 2 últimas sessões com as 2 anteriores.
 * Exige 4 sessões com accuracy definida.
 */
export function possibleAutopilot(series: SessionQualityPoint[]): boolean {
  const w = AUTOPILOT_WINDOW;
  if (series.length < 2 * w) return false;
  const span = series.slice(-2 * w);
  if (span.some((p) => p.accuracy === null)) return false;

  const prev = span.slice(0, w);
  const last = span.slice(w);
  const avg = (xs: number[]) => xs.reduce((acc, x) => acc + x, 0) / xs.length;

  const scoreUp = avg(last.map((p) => p.score)) > avg(prev.map((p) => p.score));
  const accDrop = avg(prev.map((p) => p.accuracy as number)) - avg(last.map((p) => p.accuracy as number));
  // epsilon: evita falso positivo/negativo de ponto flutuante na fronteira de 3 p.p.
  return scoreUp && accDrop > AUTOPILOT_ACCURACY_DROP + 1e-9;
}
