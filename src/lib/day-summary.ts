import type { Task } from "./types.ts";

export interface DaySummary {
  date: string;
  runs: number;
  best: number;
  second: number | null;
  avg: number;
  min: number;
  threshold: number;
  targetBefore: number | null; // T do dia anterior = a meta que valia nesse dia
  hit: boolean | null;         // best >= targetBefore; null no 1º dia
  sens: number[];              // sens distintas usadas
  isPbDay: boolean;            // best desse dia bateu o PB histórico até então
}

export function summarizeDays(task: Task | null): DaySummary[] {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return [];
  }

  // Ordena todas as sessões cronologicamente
  const sortedSessions = [...task.sessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Agrupa por data preservando a ordem cronológica
  const dateGroups = new Map<string, typeof task.sessions>();
  for (const sess of sortedSessions) {
    const list = dateGroups.get(sess.date);
    if (list) {
      list.push(sess);
    } else {
      dateGroups.set(sess.date, [sess]);
    }
  }

  const result: DaySummary[] = [];
  let prevThreshold: number | null = null;
  let runningMaxPb: number | null = null;

  for (const [date, entries] of dateGroups.entries()) {
    const scores = entries.map((e) => Number(e.pb) || 0);
    const best = Math.max(...scores);
    const min = Math.min(...scores);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    const avg = Math.round(sum / scores.length);

    const sortedScoresDesc =
      scores.length > 1 ? [...scores].sort((a, b) => b - a) : null;
    const second = sortedScoresDesc ? sortedScoresDesc[1] : null;

    // Todas as sessões do dia compartilham o threshold calculado para a data
    const threshold = entries[0].threshold;

    const targetBefore = prevThreshold;
    const hit = targetBefore !== null ? best >= targetBefore : null;

    const distinctSens = Array.from(new Set(entries.map((e) => e.sens)));

    const isPbDay = runningMaxPb === null ? true : best > runningMaxPb;
    if (runningMaxPb === null || best > runningMaxPb) {
      runningMaxPb = best;
    }

    result.push({
      date,
      runs: entries.length,
      best,
      second,
      avg,
      min,
      threshold,
      targetBefore,
      hit,
      sens: distinctSens,
      isPbDay,
    });

    prevThreshold = threshold;
  }

  return result;
}
