// Laboratório (Plano 06 / T6.2): faixa de sens com desempenho parecido por subcategoria.
// Funções puras. Faixa e penalidades são direcionais; "plano" é um resultado válido.

import type { Task } from "../types.ts";
import { buildRunPoints } from "../run-points.ts";
import { bootstrapVertex, fitQuadraticLog } from "../sens-model.ts";
import { classifyBasic, type ValidityConfig } from "../skill/validity.ts";
import { groupTrainingSessions, runTime, type RunRef } from "../skill/sessions.ts";

export type RangeConfidence = "high" | "medium" | "low" | "insufficient";

export interface CategoryRange {
  category: string;
  subcategory: string;
  centerCm: number | null;
  loCm: number | null;
  hiCm: number | null;
  confidence: RangeConfidence;
  nRuns: number;
  nSens: number;
  /** Perda prevista (% do pico) na borda mais LENTA observada (maior cm/360). */
  slowPenaltyPct: number | null;
  /** Perda prevista (% do pico) na borda mais RÁPIDA observada (menor cm/360). */
  fastPenaltyPct: number | null;
}

export interface RangeOptions {
  dpi: number;
  validity: ValidityConfig;
  /**
   * Tasks de TODAS as categorias, usadas só para formar as sessões de treino globais
   * (regras de aquecimento/pausa). Se omitido, usa `tasks` (que então deve conter todas as tasks;
   * a filtragem por categoria/subcategoria é feita internamente).
   */
  allTasks?: Task[];
}

/** Perda tolerada (fração do pico) que define a faixa. */
export const RANGE_LOSS_FRACTION = 0.02;
/** Curva cuja perda máxima nas bordas observadas é menor que isto (%) é considerada plana. */
export const FLAT_PENALTY_PCT = 2;

const GRID_N = 400;

function emptyRange(category: string, subcategory: string, nRuns: number, nSens: number): CategoryRange {
  return {
    category,
    subcategory,
    centerCm: null,
    loCm: null,
    hiCm: null,
    confidence: "insufficient",
    nRuns,
    nSens,
    slowPenaltyPct: null,
    fastPenaltyPct: null,
  };
}

/** Chaves "taskId|sessionId" das runs que passam nas regras 1–3 (sem excluir randomizadas). */
function validRunKeys(allTasks: Task[], cfg: ValidityConfig): Set<string> {
  const refs: RunRef[] = [];
  for (const task of allTasks) {
    (task.sessions ?? []).forEach((session, i) => {
      refs.push({ taskId: task.id, session, t: runTime(session, i) });
    });
  }
  const keys = new Set<string>();
  for (const group of groupTrainingSessions(refs)) {
    const byTask = new Map<string, RunRef[]>();
    for (const r of group) {
      const list = byTask.get(r.taskId);
      if (list) list.push(r);
      else byTask.set(r.taskId, [r]);
    }
    for (const list of byTask.values()) list.sort((a, b) => a.t - b.t); // sort estável
    for (const r of group) {
      const verdict = classifyBasic(r, {
        sessionGroup: group,
        scenarioRunsInSession: byTask.get(r.taskId) ?? [],
        cfg,
      });
      if (verdict === null) keys.add(`${r.taskId}|${r.session.id}`);
    }
  }
  return keys;
}

interface Quad {
  a: number;
  b: number;
  c: number;
  ref: number;
}

/** Quadrática irrestrita y = a u² + b u + c, u = ln(cm/ref). Null se degenerada. */
function fitUnconstrained(pts: Array<{ cm: number; y: number }>): Quad | null {
  const n = pts.length;
  const ref = Math.exp(pts.reduce((s, p) => s + Math.log(p.cm), 0) / n);
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const p of pts) {
    const u = Math.log(p.cm / ref);
    s1 += u; s2 += u * u; s3 += u ** 3; s4 += u ** 4;
    t0 += p.y; t1 += u * p.y; t2 += u * u * p.y;
  }
  // [n s1 s2; s1 s2 s3; s2 s3 s4] [c b a]' = [t0 t1 t2]'
  const M = [
    [n, s1, s2, t0],
    [s1, s2, s3, t1],
    [s2, s3, s4, t2],
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = col; j < 4; j++) M[col][j] /= d;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j < 4; j++) M[r][j] -= f * M[col][j];
    }
  }
  return { c: M[0][3], b: M[1][3], a: M[2][3], ref };
}

function confidenceFor(nRuns: number, nSens: number): RangeConfidence {
  if (nRuns >= 120 && nSens >= 6) return "high";
  if (nRuns >= 50 && nSens >= 4) return "medium";
  if (nRuns >= 20 && nSens >= 3) return "low";
  return "insufficient";
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function estimateCategoryRange(
  tasks: Task[],
  cat: string,
  sub: string,
  opts: RangeOptions,
): CategoryRange {
  const valid = validRunKeys(opts.allTasks ?? tasks, opts.validity);

  const subTasks = tasks
    .filter((t) => t.category === cat && t.subcategory === sub)
    .map((t) => ({
      ...t,
      sessions: (t.sessions ?? []).filter((s) => valid.has(`${t.id}|${s.id}`)),
    }));

  const points = buildRunPoints(subTasks, { dpi: opts.dpi });
  const nRuns = points.length;
  const nSens = new Set(points.map((p) => p.k)).size;

  const base = emptyRange(cat, sub, nRuns, nSens);
  let confidence = confidenceFor(nRuns, nSens);
  if (confidence === "insufficient") return base;

  const pts = points.map((p) => ({ cm: p.sens, y: p.rel }));
  const fit = fitQuadraticLog(pts);
  const quad: Quad | null = fit
    ? { a: fit.a, b: fit.b, c: fit.c, ref: fit.refCm }
    : fitUnconstrained(pts);
  if (!quad) return { ...base, confidence };

  const minCm = Math.min(...pts.map((p) => p.cm));
  const maxCm = Math.max(...pts.map((p) => p.cm));
  const pred = (cm: number) => {
    const u = Math.log(cm / quad.ref);
    return quad.a * u * u + quad.b * u + quad.c;
  };

  // Varre a faixa OBSERVADA (sem extrapolar) para achar pico, borda e faixa de perda <= 2%.
  const uLo = Math.log(minCm);
  const uHi = Math.log(maxCm);
  const grid: Array<{ cm: number; v: number }> = [];
  for (let i = 0; i <= GRID_N; i++) {
    const cm = Math.exp(uLo + ((uHi - uLo) * i) / GRID_N);
    grid.push({ cm, v: pred(cm) });
  }
  const peak = Math.max(...grid.map((g) => g.v));
  if (!(peak > 0)) return { ...base, confidence };

  const lossPct = (v: number) => Math.max(0, ((peak - v) / peak) * 100);
  const slowPenaltyPct = round2(lossPct(pred(maxCm)));
  const fastPenaltyPct = round2(lossPct(pred(minCm)));

  const inRange = grid.filter((g) => g.v >= peak * (1 - RANGE_LOSS_FRACTION));
  const loCm = round2(Math.min(...inRange.map((g) => g.cm)));
  const hiCm = round2(Math.max(...inRange.map((g) => g.cm)));

  const flat = Math.max(slowPenaltyPct, fastPenaltyPct) < FLAT_PENALTY_PCT;
  let centerCm: number | null = null;

  if (fit && fit.vertexCm !== null && !flat) {
    centerCm = fit.vertexCm;
    const ci = bootstrapVertex(pts);
    if (confidence === "high") {
      const halfWidth = ci ? Math.max(ci.high - centerCm, centerCm - ci.low) / centerCm : Infinity;
      if (!(halfWidth < 0.1)) confidence = "medium";
    }
  } else if (confidence === "high") {
    // Sem vértice: "high" exige IC do vértice < ±10%; curva plana/monotônica fica em medium.
    confidence = "medium";
  }

  return {
    category: cat,
    subcategory: sub,
    centerCm,
    loCm,
    hiCm,
    confidence,
    nRuns,
    nSens,
    slowPenaltyPct,
    fastPenaltyPct,
  };
}
