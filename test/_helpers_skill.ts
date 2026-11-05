import type { Session, Task } from "../src/lib/types.ts";

/** Sessões de teste com horário: cada dia vira UMA sessão de treino (runs a cada 3 min a partir de 10:00). */
export function makeTask(
  days: Array<{ date: string; scores: number[]; sens?: number; fov?: number }>,
  id = "task-test",
): Task {
  const sessions: Session[] = [];
  days.forEach((d, di) => {
    d.scores.forEach((pb, i) => {
      const minutes = i * 3;
      const hh = String(10 + Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      sessions.push({
        id: `${id}_d${di}_r${i}`,
        date: d.date,
        datetime: `${d.date}T${hh}:${mm}:00`,
        sens: d.sens ?? 40,
        pb,
        threshold: 0,
        fov: d.fov,
        sensRole: "base",
      });
    });
  });
  return { id, name: "1w2ts Pasu", category: "Click Timing", subcategory: "Dynamic", sessions };
}
