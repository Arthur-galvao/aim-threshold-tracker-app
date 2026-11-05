/**
 * Resumo de sessão ao vivo (Plano 07, T7.2) e z intrassessão para o alerta de fadiga (T7.4).
 *
 * Lógica pura: o hook `useLiveSession` monta as entradas; a UI só exibe o resultado.
 * - `bestScore`: maior score ajustado por sens das runs válidas do cenário na sessão (exp(max y)).
 * - `target` / `hit` / `deltaMuPct`: do SkillPoint da sessão (meta antes da sessão, batida ou não, Δμ em %).
 * - `focusOnShare`: fração das runs válidas com foco "on" entre as marcadas (on | auto); null sem ratings.
 * - `nextSuggestion`: primeira fraqueza (rankWeaknesses) com sugestão "refine" ou "stress".
 * - z de uma run = (y − μ_antes) / σ do ponto da sessão do cenário.
 */
import type { Session } from "../types.ts";
import { runTime, type RunRef } from "./sessions.ts";
import type { SkillSummary } from "./skill-model.ts";
import { focusBreakdown } from "./focus-stats.ts";
import { rankWeaknesses, type WeaknessItem, type WeaknessTaskInput } from "./weakness.ts";
import type { InvalidReason } from "./validity.ts";

export interface SummaryScenario {
  taskId: string;
  name: string;
  category: string;
  subcategory: string;
  sessions: Session[];
  skill: SkillSummary;
}

export interface ScenarioSummaryRow {
  taskId: string;
  name: string;
  category: string;
  subcategory: string;
  runs: number;
  validRuns: number;
  bestScore: number | null;
  target: number | null;
  hit: boolean | null;
  /** Variação de μ por esta sessão, em % (exp(Δ ln score) − 1). null sem valor de sessão. */
  deltaMuPct: number | null;
  invalidReasons: Partial<Record<InvalidReason, number>>;
}

export interface SessionSummary {
  sessionKey: string;
  startedAt: number;
  durationMin: number;
  runs: number;
  validRuns: number;
  invalidReasons: Partial<Record<InvalidReason, number>>;
  scenarios: ScenarioSummaryRow[];
  focusOnRuns: number;
  focusAutoRuns: number;
  focusOnShare: number | null;
  fatigueAlerts: number;
  nextSuggestion: WeaknessItem | null;
}

export interface BuildSessionSummaryInput {
  sessionKey: string;
  /** Runs da sessão (todos os cenários), já agrupadas por `groupTrainingSessions`. */
  group: RunRef[];
  /** Todos os cenários (a sugestão considera o treino inteiro, não só esta sessão). */
  scenarios: SummaryScenario[];
  nowMs: number;
  /** Sessão ainda aberta: a duração vai até `nowMs`. */
  live: boolean;
  /** Instantes (epoch ms) dos alertas de fadiga disparados nesta sessão. */
  fatigueAlertTimes?: number[];
}

export interface SessionZ {
  t: number;
  z: number;
}

function lastTrainedMs(sessions: Session[]): number | null {
  let last: number | null = null;
  sessions.forEach((s, i) => {
    const t = runTime(s, i);
    if (last === null || t > last) last = t;
  });
  return last;
}

function addReason(
  acc: Partial<Record<InvalidReason, number>>,
  reason: InvalidReason,
): void {
  acc[reason] = (acc[reason] ?? 0) + 1;
}

export function buildSessionSummary(input: BuildSessionSummaryInput): SessionSummary {
  const { sessionKey, group, scenarios, nowMs, live, fatigueAlertTimes = [] } = input;

  const startedAt = group.length > 0 ? group.reduce((m, r) => Math.min(m, r.t), Infinity) : nowMs;
  const lastT = group.length > 0 ? group.reduce((m, r) => Math.max(m, r.t), -Infinity) : startedAt;
  const endMs = live ? Math.max(nowMs, lastT) : lastT;
  const durationMin = Math.max(0, (endMs - startedAt) / 60_000);

  const rows: ScenarioSummaryRow[] = [];
  const invalidReasons: Partial<Record<InvalidReason, number>> = {};
  let runs = 0;
  let validRuns = 0;
  let focusOnRuns = 0;
  let focusAutoRuns = 0;

  for (const sc of scenarios) {
    const here = sc.skill.runs.filter((r) => r.sessionKey === sessionKey);
    if (here.length === 0) continue;

    const valid = here.filter((r) => r.validity.valid);
    const reasons: Partial<Record<InvalidReason, number>> = {};
    for (const r of here) {
      if (!r.validity.valid && r.validity.reason) {
        addReason(reasons, r.validity.reason);
        addReason(invalidReasons, r.validity.reason);
      }
    }

    const ys = valid.map((r) => r.validity.y).filter((y) => Number.isFinite(y));
    const bestY = ys.length > 0 ? Math.max(...ys) : null;

    const points = sc.skill.points.filter((p) => p.sessionKey === sessionKey);
    const point = points[0] ?? null;

    const focus = focusBreakdown({ ...sc.skill, runs: here, points }, sc.sessions);
    focusOnRuns += focus.on.n;
    focusAutoRuns += focus.auto.n;

    runs += here.length;
    validRuns += valid.length;

    rows.push({
      taskId: sc.taskId,
      name: sc.name,
      category: sc.category,
      subcategory: sc.subcategory,
      runs: here.length,
      validRuns: valid.length,
      bestScore: bestY === null ? null : Math.exp(bestY),
      target: point ? point.target : null,
      hit: point ? point.hit : null,
      deltaMuPct: point && point.sessionValue !== null ? (Math.exp(point.muAfter - point.muBefore) - 1) * 100 : null,
      invalidReasons: reasons,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const focusTotal = focusOnRuns + focusAutoRuns;
  const ranked = rankWeaknesses(
    scenarios.map(weaknessInputOf),
    nowMs,
    Number.MAX_SAFE_INTEGER,
  );

  return {
    sessionKey,
    startedAt: Number.isFinite(startedAt) ? startedAt : nowMs,
    durationMin,
    runs,
    validRuns,
    invalidReasons,
    scenarios: rows,
    focusOnRuns,
    focusAutoRuns,
    focusOnShare: focusTotal > 0 ? focusOnRuns / focusTotal : null,
    fatigueAlerts: fatigueAlertTimes.length,
    nextSuggestion: ranked.find((item) => item.suggestion !== null) ?? null,
  };
}

function weaknessInputOf(sc: SummaryScenario): WeaknessTaskInput {
  return {
    taskId: sc.taskId,
    category: sc.category,
    subcategory: sc.subcategory,
    trend: sc.skill.trend,
    hitRate14: sc.skill.hitRate14,
    lastTrainedMs: lastTrainedMs(sc.sessions),
  };
}

/** z de cada run válida da sessão, em ordem cronológica: (y − μ_antes)/σ do ponto da sessão do cenário. */
export function sessionZs(scenarios: SummaryScenario[], sessionKey: string): SessionZ[] {
  const out: SessionZ[] = [];
  for (const sc of scenarios) {
    const point = sc.skill.points.find((p) => p.sessionKey === sessionKey);
    if (!point || !(point.sigma > 0)) continue;
    for (const r of sc.skill.runs) {
      if (r.sessionKey !== sessionKey || !r.validity.valid || !Number.isFinite(r.validity.y)) continue;
      out.push({ t: r.t, z: (r.validity.y - point.muBefore) / point.sigma });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
