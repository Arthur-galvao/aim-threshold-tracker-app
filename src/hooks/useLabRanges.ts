import { useMemo } from "react";
import type { AppSettings, Task } from "@/lib/types";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY } from "@/lib/viscose";
import { estimateCategoryRange, type CategoryRange } from "@/lib/lab/category-range";
import { skillConfigFromTraining } from "@/lib/skill/config";
import { DEFAULT_VALIDITY, type ValidityConfig } from "@/lib/skill/validity";

/** DPI usado quando settings.mouse_dpi ainda não foi carregado (mesmo default do randomizer). */
export const LAB_DEFAULT_DPI = 800;

export interface LabRanges {
  /** Uma CategoryRange por subcategoria presente nas tasks. */
  ranges: CategoryRange[];
  /** "Categoria/Subcategoria" -> centro (cm/360) para `set_scenario_meta`. Só subcategorias com centro. */
  labCenters: Record<string, number>;
  mouseDpi: number;
}

const EMPTY_LAB_CENTERS: Record<string, number> = {};

/** Mapa "Categoria/Subcategoria" -> centro, a partir das faixas que têm centro (Plano 06 / T6.2). */
export function labCentersFromRanges(ranges: CategoryRange[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ranges) {
    if (r.centerCm !== null && Number.isFinite(r.centerCm) && r.centerCm > 0) {
      out[`${r.category}/${r.subcategory}`] = r.centerCm;
    }
  }
  return out;
}

/**
 * Faixa por subcategoria (função pura). Categoria/subcategoria vazias recebem o default,
 * igual ao randomizer e ao preditor atual.
 */
export function computeLabRanges(
  tasks: Task[],
  mouseDpi: number,
  validity: ValidityConfig,
): CategoryRange[] {
  const normalized: Task[] = tasks.map((task) => ({
    ...task,
    category: task.category || DEFAULT_CATEGORY,
    subcategory: task.subcategory || DEFAULT_SUBCATEGORY,
  }));

  const pairs = new Map<string, { cat: string; sub: string }>();
  for (const task of normalized) {
    const key = `${task.category}/${task.subcategory}`;
    if (!pairs.has(key)) pairs.set(key, { cat: task.category, sub: task.subcategory });
  }

  return Array.from(pairs.values()).map(({ cat, sub }) =>
    estimateCategoryRange(normalized, cat, sub, {
      dpi: mouseDpi,
      validity,
      allTasks: normalized,
    }),
  );
}

/** Validade de treino vinda das settings (ou o default, se ainda não carregadas). */
export function labValidity(settings: AppSettings | null): ValidityConfig {
  if (!settings) return DEFAULT_VALIDITY;
  return skillConfigFromTraining(settings.training ?? DEFAULT_TRAINING_SETTINGS).validity;
}

/**
 * Memo das CategoryRange por subcategoria (Plano 06). Usado pela tela do Laboratório e pelo
 * sync de metadados do randomizer (`centerSource = "lab"`). Com `enabled = false` não calcula nada.
 */
export function useLabRanges(
  tasks: Task[],
  settings: AppSettings | null,
  enabled = true,
): LabRanges {
  const mouseDpi = settings?.mouse_dpi ?? LAB_DEFAULT_DPI;
  const training = settings?.training;
  const validity = useMemo(() => labValidity(settings), [training]);

  return useMemo<LabRanges>(() => {
    if (!enabled) return { ranges: [], labCenters: EMPTY_LAB_CENTERS, mouseDpi };
    const ranges = computeLabRanges(tasks, mouseDpi, validity);
    return { ranges, labCenters: labCentersFromRanges(ranges), mouseDpi };
  }, [tasks, mouseDpi, validity, enabled]);
}
