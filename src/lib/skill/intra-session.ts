import type { SkillPoint, SkillRunInfo, SkillSummary } from "./skill-model.ts";
import { sessionKey, type RunRef } from "./sessions.ts";

/**
 * Curva intrassessão e calibração do aquecimento (Plano 07, T7.3).
 *
 * Entrada:
 * - `skills`: Map<taskId, SkillSummary> (saída de `computeSkill` por cenário, calculada sobre o mesmo `allRuns`).
 *   Só o Map é aceito: as runs são casadas com `SkillSummary.runs` por (sessionId, t) e o ponto da sessão
 *   por `sessionKey`, então o taskId é necessário.
 * - `sessions`: sessões de treino globais (saída de `groupTrainingSessions`, todos os cenários), em ordem cronológica.
 *
 * z = (y − μ_antes)/σ, onde μ_antes/σ vêm do `SkillPoint` do cenário naquela sessão.
 * X (índice) = posição da run na sessão ordenada por t, contando TODAS as runs (válidas e inválidas),
 * para que o aquecimento (runs iniciais) apareça como índices baixos. Só runs válidas entram na média de z.
 */

/** Média de z ≥ este valor conta como "estabilizado". */
export const WARMUP_Z_THRESHOLD = -0.25;
/** Quantas runs seguintes ao índice candidato também precisam estar ≥ WARMUP_Z_THRESHOLD. */
export const WARMUP_FOLLOWING_RUNS = 3;
/** Índices com menos amostras que isso não contam para a detecção de estabilização (ruído). */
export const MIN_SAMPLES_PER_INDEX = 3;
/** Janela padrão: últimas N sessões de treino. */
export const INTRA_SESSION_LAST_N = 20;

export interface IntraSessionBin {
  index: number;
  meanZ: number;
  n: number;
}

export interface IntraSessionCurve {
  /** Apenas índices com ≥ 1 amostra válida, em ordem crescente. */
  byIndex: IntraSessionBin[];
  /** Índice (= número de runs de aquecimento) em que a curva estabiliza; null se não estabiliza. */
  suggestedWarmupRuns: number | null;
}

interface SkillIndex {
  runs: Map<string, SkillRunInfo>;
  points: Map<string, SkillPoint>;
}

function runKey(sessionId: string, t: number): string {
  return `${sessionId}|${t}`;
}

export function intraSessionCurve(
  skills: Map<string, SkillSummary>,
  sessions: RunRef[][],
  lastN: number = INTRA_SESSION_LAST_N,
): IntraSessionCurve {
  const indexes = new Map<string, SkillIndex>();
  for (const [taskId, skill] of skills) {
    indexes.set(taskId, {
      runs: new Map(skill.runs.map((r) => [runKey(r.sessionId, r.t), r])),
      points: new Map(skill.points.map((p) => [p.sessionKey, p])),
    });
  }

  const recent = lastN > 0 ? sessions.slice(-lastN) : [];
  const acc = new Map<number, { sum: number; n: number }>();

  for (const group of recent) {
    if (group.length === 0) continue;
    const key = sessionKey(group);
    const ordered = [...group].sort((a, b) => a.t - b.t);
    ordered.forEach((run, index) => {
      const z = runZ(run, indexes.get(run.taskId), key);
      if (z === null) return;
      const slot = acc.get(index) ?? { sum: 0, n: 0 };
      slot.sum += z;
      slot.n += 1;
      acc.set(index, slot);
    });
  }

  const byIndex: IntraSessionBin[] = [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, { sum, n }]) => ({ index, meanZ: sum / n, n }));

  return { byIndex, suggestedWarmupRuns: findStabilization(byIndex) };
}

/** z da run, ou null se a run é inválida ou não há ponto/σ de sessão para ela. */
function runZ(run: RunRef, idx: SkillIndex | undefined, key: string): number | null {
  if (!idx) return null;
  const info = idx.runs.get(runKey(run.session.id, run.t));
  if (!info || !info.validity.valid) return null;
  const point = idx.points.get(key);
  if (!point || !(point.sigma > 0) || !Number.isFinite(info.validity.y)) return null;
  return (info.validity.y - point.muBefore) / point.sigma;
}

/** Primeiro índice i tal que i..i+WARMUP_FOLLOWING_RUNS têm média ≥ limiar (com amostras suficientes). */
function findStabilization(byIndex: IntraSessionBin[]): number | null {
  const ok = new Map<number, boolean>();
  for (const b of byIndex) ok.set(b.index, b.n >= MIN_SAMPLES_PER_INDEX && b.meanZ >= WARMUP_Z_THRESHOLD);
  for (const b of byIndex) {
    let stable = true;
    for (let k = 0; k <= WARMUP_FOLLOWING_RUNS; k++) {
      if (ok.get(b.index + k) !== true) {
        stable = false;
        break;
      }
    }
    if (stable) return b.index;
  }
  return null;
}
