/** Até 3 sens distintas: lista; acima disso (randomizer): faixa mín–máx + quantidade. */
export function formatSensSummary(sens: number[]): { text: string; count: number } {
  const distinct = Array.from(new Set(sens.filter((s) => Number.isFinite(s) && s > 0))).sort(
    (a, b) => a - b
  );
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
  if (distinct.length === 0) return { text: "", count: 0 };
  if (distinct.length <= 3) return { text: `${distinct.map(fmt).join(" · ")} cm`, count: distinct.length };
  return {
    text: `${fmt(distinct[0])}–${fmt(distinct[distinct.length - 1])} cm`,
    count: distinct.length,
  };
}
