/** Teto de FPS do loop do canvas do backdrop. */
export const BACKDROP_FPS = 30;

export type AnimationLevel = "sutil" | "moderado";

/**
 * O canvas só roda quando o nível não é "sutil" e o usuário não pediu movimento reduzido.
 * Caso contrário o backdrop fica só com o gradiente estático.
 */
export function shouldRunBackdropCanvas(level: AnimationLevel, reducedMotion: boolean): boolean {
  return !reducedMotion && level !== "sutil";
}

export interface FrameThrottle {
  /** true quando o frame com timestamp `now` (ms, como o rAF) deve ser desenhado. */
  tick(now: number): boolean;
  /** Zera o acumulador (ex.: ao retomar o loop depois de pausar). */
  reset(): void;
}

/** Acumulador de tempo: deixa passar no máximo ~`fps` frames por segundo, independente da taxa do monitor. */
export function createFrameThrottle(fps: number = BACKDROP_FPS): FrameThrottle {
  const interval = 1000 / fps;
  // Intervalos maiores que isso (aba suspensa, janela oculta) não geram rajada de frames.
  const MAX_GAP_MS = 250;
  let last: number | null = null;
  let acc = 0;

  return {
    tick(now: number): boolean {
      if (last === null) {
        last = now;
        acc = 0;
        return true;
      }
      let delta = now - last;
      last = now;
      if (!(delta >= 0)) delta = 0;
      if (delta > MAX_GAP_MS) {
        acc = 0;
        return true;
      }
      acc += delta;
      // Tolerância de 10% evita perder um frame por jitter do rAF (ex.: 60 Hz -> 30 fps exatos).
      if (acc < interval * 0.9) return false;
      acc -= interval;
      return true;
    },
    reset(): void {
      last = null;
      acc = 0;
    },
  };
}
