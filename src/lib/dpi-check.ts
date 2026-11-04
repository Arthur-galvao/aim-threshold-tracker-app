/**
 * Aviso de DPI (T3.8): o campo DPI do CSV do KovaaK's é autodeclarado e costuma estar errado.
 * Pura: recebe as sessões e o DPI configurado no app, devolve o desvio ou null.
 */

export interface DpiSessionLike {
  dpi?: number;
  datetime?: string;
  date?: string;
}

export interface DpiMismatch {
  /** Mediana do DPI informado nas sessões consideradas. */
  csvDpi: number;
  appDpi: number;
  /** |csvDpi - appDpi| / appDpi */
  deviation: number;
}

export const DPI_WINDOW = 10;
export const DPI_TOLERANCE = 0.05;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Considera as `window` sessões mais recentes (por `datetime ?? date`, de todas as tasks),
 * pega as que têm `dpi > 0` e compara a mediana do DPI informado com o DPI do app.
 * Retorna o desvio só quando ele passa de `tolerance`; senão null.
 */
export function detectDpiMismatch(
  sessions: readonly DpiSessionLike[],
  appDpi: number | null | undefined,
  window: number = DPI_WINDOW,
  tolerance: number = DPI_TOLERANCE
): DpiMismatch | null {
  if (!Number.isFinite(appDpi) || !appDpi || appDpi <= 0) return null;

  const recent = [...sessions]
    .sort((a, b) => {
      const ka = a.datetime ?? a.date ?? "";
      const kb = b.datetime ?? b.date ?? "";
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    })
    .slice(0, window);

  const declared = recent
    .map((s) => s.dpi)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0);
  if (declared.length === 0) return null;

  const csvDpi = median(declared);
  const deviation = Math.abs(csvDpi - appDpi) / appDpi;
  if (deviation <= tolerance) return null;
  return { csvDpi, appDpi, deviation };
}
