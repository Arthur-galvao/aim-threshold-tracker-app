import type { SkillSummary } from "./skill/skill-model.ts";

/** Quantas sessões recentes entram em "metas batidas" (mesma janela do hit rate de 14 sessões). */
export const RECENT_SESSIONS = 14;

/** Metas batidas nas últimas sessões avaliadas (as que tinham meta). */
export function recentHitCounts(skill: SkillSummary | null): { hit: number; total: number } {
  if (!skill) return { hit: 0, total: 0 };
  const evaluated = skill.points.filter((p) => p.hit !== null).slice(-RECENT_SESSIONS);
  return { hit: evaluated.filter((p) => p.hit === true).length, total: evaluated.length };
}

/** Estabilidade em 3 níveis a partir do CV (mesmos cortes do modo avançado). */
export function stabilityLevel(cv: number | null): "high" | "med" | "low" | null {
  if (cv === null) return null;
  if (cv < 0.05) return "high";
  if (cv < 0.1) return "med";
  return "low";
}

/** Status de uma sessão no histórico, em palavras. */
export function sessionStatus(hit: boolean | null, validRuns: number): "hit" | "miss" | "warmupOnly" | "first" {
  if (hit === true) return "hit";
  if (hit === false) return "miss";
  return validRuns === 0 ? "warmupOnly" : "first";
}
