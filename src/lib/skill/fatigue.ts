/**
 * Alerta de fadiga intrassessão (Plano 07, T7.4).
 * Dispara quando a sessão já passou de 30 min, houve pico (alguma run válida com z ≥ 0)
 * e a média de z das últimas 4 runs válidas está abaixo de −1.5. Cooldown de 15 min.
 */

export const FATIGUE_MIN_SESSION_MS = 30 * 60_000;
export const FATIGUE_COOLDOWN_MS = 15 * 60_000;
export const FATIGUE_WINDOW = 4;
export const FATIGUE_Z_THRESHOLD = -1.5;
export const FATIGUE_PEAK_Z = 0;

export interface FatigueInput {
  /** Início da sessão de treino (epoch ms). */
  sessionStartMs: number;
  /** Instante atual (epoch ms). */
  nowMs: number;
  /** z das runs válidas da sessão, em ordem cronológica. */
  zs: number[];
  /** Último instante em que o alerta disparou (epoch ms), ou null. */
  lastAlertMs: number | null;
  /** Preferência `AppSettings.training.fatigueAlerts`. */
  enabled: boolean;
}

export function shouldAlertFatigue(input: FatigueInput): boolean {
  const { sessionStartMs, nowMs, zs, lastAlertMs, enabled } = input;
  if (!enabled) return false;
  if (nowMs - sessionStartMs < FATIGUE_MIN_SESSION_MS) return false;
  if (lastAlertMs !== null && nowMs - lastAlertMs < FATIGUE_COOLDOWN_MS) return false;

  const finite = zs.filter((z) => Number.isFinite(z));
  if (!finite.some((z) => z >= FATIGUE_PEAK_Z)) return false;
  if (finite.length < FATIGUE_WINDOW) return false;

  const last = finite.slice(-FATIGUE_WINDOW);
  const mean = last.reduce((acc, z) => acc + z, 0) / FATIGUE_WINDOW;
  return mean < FATIGUE_Z_THRESHOLD;
}
