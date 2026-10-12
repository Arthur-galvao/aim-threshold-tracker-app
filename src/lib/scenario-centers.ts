/**
 * Limita o deslocamento do centro a no maximo 10% por atualizacao para evitar oscilacoes.
 */
export function stabilizeCenter(prev: number | undefined, next: number): number {
  if (prev === undefined || prev <= 0 || isNaN(prev)) {
    return Number(next.toFixed(2));
  }
  const minAllowed = prev * 0.9;
  const maxAllowed = prev * 1.1;
  const clamped = Math.max(minAllowed, Math.min(maxAllowed, next));
  return Number(clamped.toFixed(2));
}
