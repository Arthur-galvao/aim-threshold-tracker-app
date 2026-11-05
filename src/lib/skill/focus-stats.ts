/**
 * Analytics de foco (Plano 07, T7.8): compara runs marcadas "on" (foco) com "auto" (piloto).
 *
 * Definições:
 * - Entram só runs válidas (`validity.valid`) cuja sessão (`Session.focus`) é "on" ou "auto".
 *   Runs sem avaliação (`focus` null/ausente) ficam de fora.
 * - `n`: quantidade de runs do grupo.
 * - `meanY`: média de `validity.y` (ln(score), possivelmente ajustado por sens) das runs do grupo.
 *   null quando o grupo está vazio.
 * - `hitRate`: entre as sessões de treino (`sessionKey`) que contêm ao menos uma run do grupo e cujo
 *   `SkillPoint.hit` é definido, a fração em que a meta foi batida. null quando não há nenhuma.
 *   A primeira sessão (hit null) não conta.
 *
 * `sessions` deve conter as sessões (runs) com `id` igual a `SkillRunInfo.sessionId`.
 */
import type { Session, SessionFocus } from "../types.ts";
import type { SkillSummary } from "./skill-model.ts";

export interface FocusGroupStats {
  n: number;
  meanY: number | null;
  hitRate: number | null;
}

export interface FocusBreakdown {
  on: FocusGroupStats;
  auto: FocusGroupStats;
}

interface Accumulator {
  n: number;
  ySum: number;
  yCount: number;
  sessionKeys: Set<string>;
}

function newAccumulator(): Accumulator {
  return { n: 0, ySum: 0, yCount: 0, sessionKeys: new Set() };
}

export function focusBreakdown(summary: SkillSummary, sessions: Session[]): FocusBreakdown {
  const focusById = new Map<string, SessionFocus>();
  for (const s of sessions) focusById.set(s.id, s.focus ?? null);

  const hitByKey = new Map<string, boolean | null>();
  for (const p of summary.points) hitByKey.set(p.sessionKey, p.hit);

  const acc: Record<"on" | "auto", Accumulator> = { on: newAccumulator(), auto: newAccumulator() };
  for (const run of summary.runs) {
    if (!run.validity.valid) continue;
    const focus = focusById.get(run.sessionId) ?? null;
    if (focus !== "on" && focus !== "auto") continue;

    const g = acc[focus];
    g.n += 1;
    if (Number.isFinite(run.validity.y)) {
      g.ySum += run.validity.y;
      g.yCount += 1;
    }
    g.sessionKeys.add(run.sessionKey);
  }

  return { on: finish(acc.on, hitByKey), auto: finish(acc.auto, hitByKey) };
}

function finish(g: Accumulator, hitByKey: Map<string, boolean | null>): FocusGroupStats {
  let decided = 0;
  let hits = 0;
  for (const key of g.sessionKeys) {
    const hit = hitByKey.get(key);
    if (hit === undefined || hit === null) continue;
    decided += 1;
    if (hit) hits += 1;
  }
  return {
    n: g.n,
    meanY: g.yCount > 0 ? g.ySum / g.yCount : null,
    hitRate: decided > 0 ? hits / decided : null,
  };
}
