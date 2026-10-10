import type { Task } from "./types";
import { predictOptimalSensitivity, type RunDataPoint } from "./sens-analytics.ts";

export const VISCOSE_CATEGORIES: Record<string, string[]> = {
  "Flick Tech": ["Speed", "Stability", "Micro", "Post-Flick"],
  "Click Timing": ["Reading", "Precision", "Stability"],
  "Control Tracking": ["Arm", "Wrist", "Fingertip", "Blending"],
  "Reactive Tracking": ["Control", "Speed", "Reading"],
};

export const VISCOSE_RECOMMENDED_SENS: Record<
  string,
  Record<string, number>
> = {
  "Control Tracking": { Arm: 34, Wrist: 44, Fingertip: 40, Blending: 44 },
  "Reactive Tracking": { Control: 34, Speed: 28, Reading: 30 },
  "Flick Tech": { Speed: 45, Stability: 55, Micro: 65, "Post-Flick": 44 },
  "Click Timing": { Reading: 45, Precision: 60, Stability: 50 },
};

export const DEFAULT_CATEGORY = "Click Timing";
export const DEFAULT_SUBCATEGORY = "Precision";

export function getRecommendedSens(
  category: string,
  subcategory: string
): number | null {
  return VISCOSE_RECOMMENDED_SENS[category]?.[subcategory] ?? null;
}

interface ScenarioRule {
  test: (name: string) => boolean;
  category: string;
  subcategory: string;
}

const SCENARIO_RULES: ScenarioRule[] = [
  {
    test: (n) => n.includes("pasu"),
    category: "Click Timing",
    subcategory: "Reading",
  },
  {
    test: (n) =>
      /1w\d*te?s/.test(n) ||
      ["1wall", "2wall", "3wall", "4wall", "5wall", "6wall"].some((w) =>
        n.includes(w)
      ),
    category: "Click Timing",
    subcategory: "Precision",
  },
  {
    test: (n) => n.includes("microshot"),
    category: "Flick Tech",
    subcategory: "Micro",
  },
  {
    test: (n) =>
      ["wall", "flick", "reflex", "vex", "fan the hammer", "pistol"].some((k) =>
        n.includes(k)
      ),
    category: "Flick Tech",
    subcategory: "Speed",
  },
  {
    test: (n) =>
      ["click", "vbr", "target switch", "target_speed", "plink", "shot"].some(
        (k) => n.includes(k)
      ),
    category: "Click Timing",
    subcategory: "Precision",
  },
  {
    test: (n) => /ts\b/.test(n),
    category: "Click Timing",
    subcategory: "Reading",
  },
  {
    test: (n) =>
      ["fuglaa", "reactive", "straf", "longstrafes", "tam", "aether"].some(
        (k) => n.includes(k)
      ),
    category: "Reactive Tracking",
    subcategory: "Reading",
  },
  {
    test: (n) =>
      [
        "smooth",
        "angelic",
        "ufo",
        "pokeball",
        "narrow",
        "sphere",
        "sky",
        "flower",
        "air ",
        "air_",
      ].some((k) => n.includes(k)),
    category: "Control Tracking",
    subcategory: "Wrist",
  },
  {
    test: (n) =>
      ["bounce", "ground", "switching", "switch"].some((k) => n.includes(k)),
    category: "Reactive Tracking",
    subcategory: "Speed",
  },
  {
    test: (n) =>
      ["tracking", "centering", "prediction", "cata", "control", "pressure", "kontr", "contr"].some(
        (k) => n.includes(k)
      ),
    category: "Control Tracking",
    subcategory: "Wrist",
  },
];

export function cleanScenarioName(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // Pattern: CsLevel.<author>.<scenario>.<hash/code>
  // e.g. "CsLevel.Lowgravity56.VT Suave.RX1H0T" -> "VT Suave"
  // e.g. "CsLevel.VT Empyrean.VT Float.QZWM5U" -> "VT Float"
  if (trimmed.startsWith("CsLevel.")) {
    const parts = trimmed.split(".");
    if (parts.length >= 4) {
      const middle = parts.slice(2, parts.length - 1).join(".").trim();
      if (middle) return middle;
    } else if (parts.length === 3) {
      const middle = parts[1].trim();
      if (middle) return middle;
    }
  }

  // Pattern: CsLevel<guid>
  if (trimmed.startsWith("CsLevel")) {
    const stripped = trimmed.replace(/^CsLevel[-_.]*/i, "").trim();
    if (stripped) return stripped;
  }

  return trimmed;
}

export function categorizeScenario(
  scenario: string
): { category: string; subcategory: string } {
  const cleaned = cleanScenarioName(scenario);
  const name = cleaned.toLowerCase();
  for (const rule of SCENARIO_RULES) {
    if (rule.test(name)) {
      return { category: rule.category, subcategory: rule.subcategory };
    }
  }
  return { category: DEFAULT_CATEGORY, subcategory: DEFAULT_SUBCATEGORY };
}

export function migrateAndCategorizeTasks(tasks: Task[]): boolean {
  let changed = false;
  for (const task of tasks) {
    if (task.name.startsWith("CsLevel")) {
      const cleaned = cleanScenarioName(task.name);
      if (cleaned !== task.name) {
        task.name = cleaned;
        changed = true;
      }
    }

    if (task.category === "Voltaic / Outros") {
      const { category, subcategory } = categorizeScenario(task.name);
      task.category = category;
      task.subcategory = subcategory;
      changed = true;
    } else if (
      task.category === DEFAULT_CATEGORY &&
      task.subcategory === DEFAULT_SUBCATEGORY
    ) {
      const { category, subcategory } = categorizeScenario(task.name);
      if (category !== DEFAULT_CATEGORY || subcategory !== DEFAULT_SUBCATEGORY) {
        task.category = category;
        task.subcategory = subcategory;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Retorna a sensibilidade recomendada para uma dada categoria e subcategoria.
 * Prioriza a sensibilidade predita se houver pelo menos 8 runs com confianca suficiente;
 * caso contrario, recorre a tabela estatica do benchmark Viscose.
 */
export function getDisplaySens(
  category: string,
  subcategory: string,
  groupRuns?: RunDataPoint[]
): { value: number; source: "predicted" | "viscose" } {
  if (groupRuns && groupRuns.length >= 8) {
    const predicted = predictOptimalSensitivity([], "equilibrado", { groupRuns });
    if (predicted && predicted.confidence !== "insufficient") {
      return { value: predicted.predictedSens, source: "predicted" };
    }
  }
  const fallback =
    getRecommendedSens(category, subcategory) ??
    getRecommendedSens(DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY) ??
    45;
  return { value: fallback, source: "viscose" };
}
