import type { RunRef } from "./sessions.ts";
import { median, clamp } from "./stats.ts";

/**
 * Ajuste de score por sens (Threshold v2, T4.3).
 * Modelo: y = ln(score) = base + b·Δ² + ruído, Δ = ln(sens/center), b ≤ 0.
 * O efeito de sessão é controlado usando o resíduo dentro da sessão (vs mediana das runs
 * do mesmo cenário na mesma sessão), para não confundir evolução ao longo das semanas com sens.
 */
export interface SensAdjustModel {
  b: number;
  reliable: boolean;
  n: number;
  centerFallback: number;
}

const WINDOW = 300;
const SHRINK_K = 30;
const MAX_CORRECTION = Math.log(1.25);
const BUCKET = Math.log(1.05);

function runKey(r: RunRef): string {
  return `${r.taskId}|${r.session.id}`;
}

function logScore(r: RunRef): number {
  return Math.log(r.session.pb);
}

/**
 * Ajusta o modelo de um cenário.
 * @param runs     runs DO cenário (qualquer ordem)
 * @param sessions sessões de treino globais (grupos); só as runs do cenário em cada grupo são usadas
 */
export function fitSensAdjust(runs: RunRef[], sessions: RunRef[][]): SensAdjustModel {
  const usable = runs.filter((r) => r.session.pb > 0 && r.session.sens > 0);
  const window = [...usable].sort((a, b) => a.t - b.t).slice(-WINDOW);
  if (window.length === 0) return { b: 0, reliable: false, n: 0, centerFallback: 0 };

  const centerFallback = median(window.map((r) => r.session.sens));
  const inWindow = new Set(window.map(runKey));
  const taskIds = new Set(window.map((r) => r.taskId));
  const centerOf = (r: RunRef) => r.session.rollCenterCm ?? centerFallback;

  const lattices = new Set<number>();
  const buckets = new Set<number>();
  for (const r of window) {
    if (r.session.latticeK !== undefined) lattices.add(r.session.latticeK);
    buckets.add(Math.round(Math.log(r.session.sens) / BUCKET));
  }

  let num = 0;
  let den = 0;
  let n = 0;
  let sessionsWithVariation = 0;
  for (const group of sessions) {
    const mine = group.filter((r) => taskIds.has(r.taskId) && inWindow.has(runKey(r)));
    if (mine.length < 2) continue;
    const med = median(mine.map(logScore));
    const sensBuckets = new Set<number>();
    const pts: Array<{ r: number; d2: number }> = [];
    for (const r of mine) {
      const c = centerOf(r);
      if (!(c > 0)) continue;
      const d = Math.log(r.session.sens / c);
      pts.push({ r: logScore(r) - med, d2: d * d });
      sensBuckets.add(Math.round(Math.log(r.session.sens) / BUCKET));
    }
    // Regressor centrado na mediana da sessão: o resíduo r é relativo à mediana de y, que já
    // contém b·mediana(Δ²). Sem centrar, o MQO pela origem fica enviesado para 0 (~50%).
    const medD2 = median(pts.map((p) => p.d2));
    for (const p of pts) {
      const x = p.d2 - medD2;
      num += p.r * x;
      den += x * x;
      n++;
    }
    if (sensBuckets.size >= 2) sessionsWithVariation++;
  }

  const bHat = den > 0 ? Math.min(num / den, 0) : 0;
  const b = bHat * (n / (n + SHRINK_K));
  const distinctOk = lattices.size >= 3 || buckets.size >= 3;
  const reliable = n >= 30 && distinctOk && sessionsWithVariation >= 5;
  return { b, reliable, n, centerFallback };
}

function delta(sens: number, center: number): number | null {
  if (!(sens > 0) || !(center > 0)) return null;
  return Math.log(sens / center);
}

/** y − b·Δ² (correção limitada a ln 1.25). Modelo não confiável → y inalterado. */
export function adjustLogScore(y: number, sens: number, center: number, m: SensAdjustModel): number {
  if (!m.reliable) return y;
  const d = delta(sens, center);
  if (d === null) return y;
  return y + clamp(-m.b * d * d, 0, MAX_CORRECTION);
}

/** Meta equivalente na sens atual: T·exp(b·Δ²) (mesmo limite da correção). Não confiável → T. */
export function targetAtSens(targetCenter: number, sens: number, center: number, m: SensAdjustModel): number {
  if (!m.reliable) return targetCenter;
  const d = delta(sens, center);
  if (d === null) return targetCenter;
  return targetCenter * Math.exp(-clamp(-m.b * d * d, 0, MAX_CORRECTION));
}
