import type { Session, Task } from "./types.ts";
import type { SkillSummary } from "./skill/skill-model.ts";
import type { RunValidity } from "./skill/validity.ts";

/**
 * Resumos por SESSÃO DE TREINO (Threshold v2): a unidade de agrupamento é a sessão
 * (gap <= 45 min, global entre cenários), não o dia. Tudo derivado de `SkillSummary`.
 */

export interface TrainingSessionRun {
  session: Session;
  t: number;
  validity: RunValidity;
}

export interface TrainingSessionSummary {
  /** Mesma chave de `SkillPoint.sessionKey`. */
  key: string;
  /** Início da primeira / última run DO CENÁRIO nesta sessão (epoch ms). */
  startedAt: number;
  endedAt: number;
  /** Data local (YYYY-MM-DD) do início. */
  date: string;
  runs: number;
  validRuns: number;
  /** Melhor score bruto (qualquer run, válida ou não). */
  best: number;
  /** Melhor score válido já ajustado por sens (escala de score); null sem válidas. */
  bestAdjusted: number | null;
  /** Meta que valia ANTES da sessão (escala de score); null na 1ª sessão. */
  target: number | null;
  hit: boolean | null;
  /** μ após a sessão (escala de score). */
  mu: number | null;
  sens: number[];
  /** O melhor bruto da sessão bateu o PB acumulado até então. */
  isPb: boolean;
  items: TrainingSessionRun[];
}

function localDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sessões de treino do cenário, em ordem cronológica. Sem `skill` → []. */
export function summarizeTrainingSessions(
  task: Task | null,
  skill: SkillSummary | null,
): TrainingSessionSummary[] {
  if (!task || !skill || skill.runs.length === 0) return [];
  const sessionById = new Map<string, Session>();
  for (const s of task.sessions ?? []) sessionById.set(s.id, s);
  const pointByKey = new Map(skill.points.map((p) => [p.sessionKey, p]));
  const firstPointKey = skill.points[0]?.sessionKey ?? null;

  const order: string[] = [];
  const groups = new Map<string, TrainingSessionRun[]>();
  for (const info of skill.runs) {
    const session = sessionById.get(info.sessionId);
    if (!session) continue;
    let list = groups.get(info.sessionKey);
    if (!list) {
      list = [];
      groups.set(info.sessionKey, list);
      order.push(info.sessionKey);
    }
    list.push({ session, t: info.t, validity: info.validity });
  }

  const out: TrainingSessionSummary[] = [];
  let runningPb: number | null = null;
  for (const key of order) {
    const items = groups.get(key)!;
    const point = pointByKey.get(key) ?? null;
    const scores = items.map((i) => Number(i.session.pb) || 0);
    const best = Math.max(...scores);
    const validYs = items.filter((i) => i.validity.valid).map((i) => i.validity.y);
    const times = items.map((i) => i.t);
    const startedAt = Math.min(...times);
    out.push({
      key,
      startedAt,
      endedAt: Math.max(...times),
      date: localDate(startedAt),
      runs: items.length,
      validRuns: validYs.length,
      best,
      bestAdjusted: validYs.length > 0 ? Math.exp(Math.max(...validYs)) : null,
      target: point && key !== firstPointKey ? point.target : null,
      hit: point ? point.hit : null,
      mu: point ? Math.exp(point.muAfter) : null,
      sens: Array.from(new Set(items.map((i) => i.session.sens))),
      isPb: runningPb === null ? true : best > runningPb,
      items,
    });
    if (runningPb === null || best > runningPb) runningPb = best;
  }
  return out;
}

export interface ChartRunPoint {
  /** Posição no eixo X (índice da run, 0..n-1). */
  index: number;
  id: string;
  t: number;
  score: number;
  sens: number;
  valid: boolean;
  reason?: RunValidity["reason"];
  sessionKey: string;
  /** Índice da sessão em `sessions`. */
  sessionIdx: number;
}

export interface ChartSessionStep {
  key: string;
  startIdx: number;
  endIdx: number;
  /** Meta antes da sessão; null na 1ª. */
  target: number | null;
  mu: number;
  lo: number;
  hi: number;
  hit: boolean | null;
  nValid: number;
  startedAt: number;
}

export interface ChartSeries {
  runs: ChartRunPoint[];
  sessions: ChartSessionStep[];
  /** PB acumulado (score bruto) após cada run. */
  pbRunning: number[];
}

/** Séries do gráfico: pontos por run e degraus por sessão (meta, μ, μ±σ). */
export function buildChartSeries(task: Task | null, skill: SkillSummary | null): ChartSeries {
  const empty: ChartSeries = { runs: [], sessions: [], pbRunning: [] };
  if (!task || !skill || skill.runs.length === 0) return empty;
  const pointByKey = new Map(skill.points.map((p) => [p.sessionKey, p]));
  const runs: ChartRunPoint[] = [];
  const sessions: ChartSessionStep[] = [];
  const sessionIdxByKey = new Map<string, number>();
  const pbRunning: number[] = [];
  let pb = 0;
  const firstPointKey = skill.points[0]?.sessionKey ?? null;

  for (const info of skill.runs) {
    let sIdx = sessionIdxByKey.get(info.sessionKey);
    const index = runs.length;
    if (sIdx === undefined) {
      sIdx = sessions.length;
      sessionIdxByKey.set(info.sessionKey, sIdx);
      const p = pointByKey.get(info.sessionKey);
      const mu = p ? Math.exp(p.muAfter) : NaN;
      const sigma = p ? p.sigma : 0;
      sessions.push({
        key: info.sessionKey,
        startIdx: index,
        endIdx: index,
        target: p && info.sessionKey !== firstPointKey ? p.target : null,
        mu,
        lo: p ? Math.exp(p.muAfter - sigma) : NaN,
        hi: p ? Math.exp(p.muAfter + sigma) : NaN,
        hit: p ? p.hit : null,
        nValid: p ? p.nValid : 0,
        startedAt: info.t,
      });
    }
    sessions[sIdx].endIdx = index;
    runs.push({
      index,
      id: info.sessionId,
      t: info.t,
      score: info.score,
      sens: info.sens,
      valid: info.validity.valid,
      reason: info.validity.reason,
      sessionKey: info.sessionKey,
      sessionIdx: sIdx,
    });
    if (info.score > pb) pb = info.score;
    pbRunning.push(pb);
  }
  return { runs, sessions, pbRunning };
}

/** Mantém só as runs que passam em `keep`, reindexando eixo X e sessões (sessões vazias somem). */
export function filterChartSeries(series: ChartSeries, keep: (run: ChartRunPoint) => boolean): ChartSeries {
  const runs: ChartRunPoint[] = [];
  const pbRunning: number[] = [];
  const sessions: ChartSessionStep[] = [];
  const newIdxByOld = new Map<number, number>();

  series.runs.forEach((run, i) => {
    if (!keep(run)) return;
    const index = runs.length;
    const old = series.sessions[run.sessionIdx];
    let sIdx = newIdxByOld.get(run.sessionIdx);
    if (sIdx === undefined) {
      sIdx = sessions.length;
      newIdxByOld.set(run.sessionIdx, sIdx);
      sessions.push({ ...old, startIdx: index, endIdx: index });
    }
    sessions[sIdx].endIdx = index;
    runs.push({ ...run, index, sessionIdx: sIdx });
    pbRunning.push(series.pbRunning[i]);
  });
  return { runs, sessions, pbRunning };
}
