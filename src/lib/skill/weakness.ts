/**
 * Prioridade de fraquezas v2 (Plano 07, T7.10).
 *
 * Entrada: uma linha por cenário (task) com a tendência e hit rate do SkillSummary e a última vez treinado.
 * Agregação por subcategoria:
 * - tendência = pior entre os cenários (down > flat > insufficient > up);
 * - hitRate14 = média dos cenários com valor (null se nenhum);
 * - diasSemTreinar = menor distância entre os cenários da subcategoria (o treino mais recente conta).
 *
 * priority = 0.4·T + 0.3·(1 − hitRate14) + 0.3·min(1, dias/7)
 *   T: down=1, flat=0.6, insufficient=0.6, up=0; hitRate14 null → 0.5; dias null → 1.
 * Sugestão: "refine" se hitRate14 < 0.35; "stress" se tendência flat e hitRate14 > 0.6; senão null.
 */

export type WeaknessTrend = "up" | "flat" | "down" | "insufficient";
export type WeaknessSuggestion = "refine" | "stress" | null;

export interface WeaknessTaskInput {
  taskId: string;
  category: string;
  subcategory: string;
  trend: WeaknessTrend;
  /** 0..1, de SkillSummary.hitRate14. */
  hitRate14: number | null;
  /** Último instante de treino do cenário (epoch ms), ou null se nunca treinado. */
  lastTrainedMs: number | null;
}

export interface WeaknessItem {
  category: string;
  subcategory: string;
  taskIds: string[];
  priority: number;
  trend: WeaknessTrend;
  hitRate14: number | null;
  daysSinceTrained: number | null;
  suggestion: WeaknessSuggestion;
}

export const WEAKNESS_TOP_N = 3;
export const WEAKNESS_REFINE_BELOW = 0.35;
export const WEAKNESS_STRESS_ABOVE = 0.6;
export const WEAKNESS_DAYS_FULL = 7;
const DAY_MS = 86_400_000;

const TREND_SCORE: Record<WeaknessTrend, number> = { down: 1, flat: 0.6, insufficient: 0.6, up: 0 };
/** Ordem de "pior" tendência para agregar cenários. */
const TREND_WORST_ORDER: WeaknessTrend[] = ["down", "flat", "insufficient", "up"];

/** Pior tendência de um conjunto (lista vazia → insufficient). */
export function worstTrend(trends: WeaknessTrend[]): WeaknessTrend {
  for (const t of TREND_WORST_ORDER) if (trends.includes(t)) return t;
  return "insufficient";
}

export function weaknessPriority(trend: WeaknessTrend, hitRate14: number | null, daysSinceTrained: number | null): number {
  const hit = hitRate14 ?? 0.5;
  const recency = daysSinceTrained === null ? 1 : Math.min(1, Math.max(0, daysSinceTrained) / WEAKNESS_DAYS_FULL);
  return 0.4 * TREND_SCORE[trend] + 0.3 * (1 - hit) + 0.3 * recency;
}

export function weaknessSuggestion(trend: WeaknessTrend, hitRate14: number | null): WeaknessSuggestion {
  if (hitRate14 === null) return null;
  if (hitRate14 < WEAKNESS_REFINE_BELOW) return "refine";
  if (trend === "flat" && hitRate14 > WEAKNESS_STRESS_ABOVE) return "stress";
  return null;
}

/** Top N subcategorias por prioridade (desc), com sugestão. Empate: nome da subcategoria. */
export function rankWeaknesses(tasks: WeaknessTaskInput[], nowMs: number, topN: number = WEAKNESS_TOP_N): WeaknessItem[] {
  const groups = new Map<string, WeaknessTaskInput[]>();
  for (const task of tasks) {
    const key = JSON.stringify([task.category, task.subcategory]);
    const list = groups.get(key);
    if (list) list.push(task);
    else groups.set(key, [task]);
  }

  const items: WeaknessItem[] = [];
  for (const group of groups.values()) {
    const { category, subcategory } = group[0];
    const trend = worstTrend(group.map((t) => t.trend));
    const hits = group.map((t) => t.hitRate14).filter((h): h is number => h !== null);
    const hitRate14 = hits.length > 0 ? hits.reduce((acc, h) => acc + h, 0) / hits.length : null;
    const lasts = group.map((t) => t.lastTrainedMs).filter((t): t is number => t !== null);
    const daysSinceTrained = lasts.length > 0 ? Math.max(0, (nowMs - Math.max(...lasts)) / DAY_MS) : null;

    items.push({
      category,
      subcategory,
      taskIds: group.map((t) => t.taskId),
      priority: weaknessPriority(trend, hitRate14, daysSinceTrained),
      trend,
      hitRate14,
      daysSinceTrained,
      suggestion: weaknessSuggestion(trend, hitRate14),
    });
  }

  items.sort((a, b) => b.priority - a.priority || a.subcategory.localeCompare(b.subcategory));
  return items.slice(0, Math.max(0, topN));
}
