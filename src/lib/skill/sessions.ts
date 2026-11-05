import type { Session } from "../types.ts";

/** Uma run com seu instante de início (epoch ms) e a sessão de origem. */
export interface RunRef {
  taskId: string;
  session: Session;
  t: number; // epoch ms
}

/**
 * Instante de início da run (epoch ms).
 * - Com `datetime` (ISO local YYYY-MM-DDTHH:MM:SS): interpretado como horário local.
 * - Sem `datetime` (legado): `date` (YYYY-MM-DD) às 12:00 local + `index` ms,
 *   preservando a ordem da posição da sessão no array do task.
 */
export function runTime(s: Session, index = 0): number {
  if (s.datetime) return new Date(s.datetime).getTime();
  return new Date(`${s.date}T12:00:00`).getTime() + index;
}

/**
 * Agrupa runs em sessões de treino. Agrupamento global (todos os cenários).
 * - Runs com datetime: ordenadas por t; quebra quando o intervalo entre runs consecutivas
 *   é maior que `gapMin` minutos.
 * - Runs legadas (sem datetime): um grupo por `session.date`, separado dos grupos com datetime.
 * Os grupos saem ordenados pelo instante do primeiro run; a ordem das runs legadas é preservada.
 */
export function groupTrainingSessions(runs: RunRef[], gapMin = 45): RunRef[][] {
  const dated: RunRef[] = [];
  const legacyByDate = new Map<string, RunRef[]>();
  for (const r of runs) {
    if (r.session.datetime) {
      dated.push(r);
    } else {
      const list = legacyByDate.get(r.session.date);
      if (list) list.push(r);
      else legacyByDate.set(r.session.date, [r]);
    }
  }

  const groups: RunRef[][] = [];

  const sortedDated = [...dated].sort((a, b) => a.t - b.t);
  const gapMs = gapMin * 60_000;
  let current: RunRef[] = [];
  for (const r of sortedDated) {
    const prev = current[current.length - 1];
    if (prev && r.t - prev.t > gapMs) {
      groups.push(current);
      current = [];
    }
    current.push(r);
  }
  if (current.length > 0) groups.push(current);

  for (const list of legacyByDate.values()) groups.push(list);

  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g[0].t - b.g[0].t || a.i - b.i)
    .map(({ g }) => g);
}

/** Chave estável da sessão: ISO do instante do primeiro run. */
export function sessionKey(group: RunRef[]): string {
  return new Date(group[0].t).toISOString();
}
