import type { Session } from "../../src/lib/types.ts";
import type { RunRef } from "../../src/lib/skill/sessions.ts";

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão via Box-Muller. */
export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const MIN = 60_000;
export const DAY = 86_400_000;
export const T0 = new Date("2026-01-01T10:00:00Z").getTime();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO local YYYY-MM-DDTHH:MM:SS (como o app grava). */
export function localIso(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let counter = 0;
export function makeRun(taskId: string, t: number, pb: number, sens: number, extra: Partial<Session> = {}): RunRef {
  const datetime = localIso(t);
  const session: Session = {
    id: `${taskId}-${++counter}`,
    date: datetime.slice(0, 10),
    datetime,
    sens,
    pb,
    threshold: 0,
    ...extra,
  };
  return { taskId, session, t: new Date(datetime).getTime() };
}
