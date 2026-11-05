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

/** Score legível para leigo: separador de milhar do idioma (1.110 / 1,110) e no máximo 1 casa. */
export function formatScore(value: number, lang: "pt" | "en"): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export interface XLabelCandidate {
  x: number;
  label: string;
}

/**
 * Escolhe os rótulos do eixo X sem sobreposição: descarta rótulos repetidos em sequência
 * (mesma data em sessões vizinhas) e os que ficam a menos de `minGap` do último mantido.
 */
export function pickXLabels<T extends XLabelCandidate>(items: T[], minGap: number): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const last = kept[kept.length - 1];
    if (last && (item.label === last.label || item.x - last.x < minGap)) continue;
    kept.push(item);
  }
  return kept;
}
