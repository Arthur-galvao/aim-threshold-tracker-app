/**
 * Plano 05 (T5.6): cálculo puro do centro (cm/360) de cada cenário, enviado ao Rust
 * via `set_scenario_meta`. Sem React/Tauri: testável com node --test.
 */
import { VISCOSE_RECOMMENDED_SENS } from "./viscose.ts";
import type { ScenarioMeta } from "./types.ts";

export type CenterSource = "personal_relative" | "viscose_absolute" | "base" | "lab";

export interface ScenarioCenterInput {
  baseSensCm: number;
  centerSource: CenterSource;
  /** Override manual por nome normalizado (trim + lowercase). Vence qualquer fonte. */
  centerOverrides?: Record<string, number>;
  /** Sugestão do Laboratório (Plano 06) por "Categoria/Subcategoria". Opcional; sem entrada cai para personal_relative. */
  labCenters?: Record<string, number>;
}

export interface ScenarioTaskInput {
  name: string;
  category: string;
  subcategory: string;
}

/** Nome normalizado usado como chave do mapa (igual ao Rust: trim + to_lowercase). */
export function normalizeScenarioName(name: string): string {
  return name.trim().toLowerCase();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Mediana de todas as sensibilidades recomendadas da Viscose (referência do modo personal_relative). */
export function viscoseMedian(): number {
  const all: number[] = [];
  for (const subs of Object.values(VISCOSE_RECOMMENDED_SENS)) {
    all.push(...Object.values(subs));
  }
  return median(all);
}

function viscoseValue(category: string, subcategory: string): number | null {
  return VISCOSE_RECOMMENDED_SENS[category]?.[subcategory] ?? null;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Centro de um cenário conforme a fonte. Override manual vence; subcategoria desconhecida
 * (ou base inválida) cai na base.
 */
export function computeScenarioCenter(task: ScenarioTaskInput, input: ScenarioCenterInput): number {
  const override = input.centerOverrides?.[normalizeScenarioName(task.name)];
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return round2(override);
  }

  const { baseSensCm } = input;
  const key = `${task.category}/${task.subcategory}`;
  const viscose = viscoseValue(task.category, task.subcategory);
  if (viscose === null) return round2(baseSensCm);

  switch (input.centerSource) {
    case "base":
      return round2(baseSensCm);
    case "viscose_absolute":
      return round2(viscose);
    case "lab": {
      const lab = input.labCenters?.[key];
      if (typeof lab === "number" && Number.isFinite(lab) && lab > 0) return round2(lab);
      return round2(baseSensCm * (viscose / viscoseMedian()));
    }
    case "personal_relative":
    default:
      return round2(baseSensCm * (viscose / viscoseMedian()));
  }
}

/** Monta o payload de `set_scenario_meta` para todas as tasks com nome. */
export function buildScenarioMeta(
  tasks: ScenarioTaskInput[],
  input: ScenarioCenterInput
): Record<string, ScenarioMeta> {
  const meta: Record<string, ScenarioMeta> = {};
  for (const task of tasks) {
    const name = normalizeScenarioName(task.name);
    if (!name) continue;
    meta[name] = {
      centerCm: computeScenarioCenter(task, input),
      category: task.category,
      subcategory: task.subcategory,
    };
  }
  return meta;
}
