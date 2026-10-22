import type { Task } from "./types";
import type { Key } from "./i18n.tsx";
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

export interface SubcategoryCoachingCue {
  mechanicKey: Key;
  quietEyeKey: Key;
}

const SUBCATEGORY_COACHING_CUES: Record<string, Record<string, SubcategoryCoachingCue>> = {
  "Click Timing": {
    Precision: { mechanicKey: "coach.clickPrecision", quietEyeKey: "coach.qeClicking" },
    Reading: { mechanicKey: "coach.clickReading", quietEyeKey: "coach.qeClicking" },
    Stability: { mechanicKey: "coach.clickStability", quietEyeKey: "coach.qeClicking" },
  },
  "Control Tracking": {
    Arm: { mechanicKey: "coach.trackArm", quietEyeKey: "coach.qeTracking" },
    Wrist: { mechanicKey: "coach.trackWrist", quietEyeKey: "coach.qeTracking" },
    Fingertip: { mechanicKey: "coach.trackFingertip", quietEyeKey: "coach.qeTracking" },
    Blending: { mechanicKey: "coach.trackBlending", quietEyeKey: "coach.qeTracking" },
  },
  "Reactive Tracking": {
    Control: { mechanicKey: "coach.reactiveControl", quietEyeKey: "coach.qeTracking" },
    Speed: { mechanicKey: "coach.reactiveSpeed", quietEyeKey: "coach.qeTracking" },
    Reading: { mechanicKey: "coach.reactiveReading", quietEyeKey: "coach.qeTracking" },
  },
  "Flick Tech": {
    Speed: { mechanicKey: "coach.flickSpeed", quietEyeKey: "coach.qeSwitching" },
    Stability: { mechanicKey: "coach.flickStability", quietEyeKey: "coach.qeSwitching" },
    Micro: { mechanicKey: "coach.flickMicro", quietEyeKey: "coach.qeClicking" },
    "Post-Flick": { mechanicKey: "coach.flickPost", quietEyeKey: "coach.qeSwitching" },
  },
};

export function getSubcategoryCoachingCue(
  category: string,
  subcategory: string
): SubcategoryCoachingCue {
  return (
    SUBCATEGORY_COACHING_CUES[category]?.[subcategory] ??
    SUBCATEGORY_COACHING_CUES[DEFAULT_CATEGORY][DEFAULT_SUBCATEGORY]
  );
}

interface ScenarioRule {
  test: (name: string) => boolean;
  category: string;
  subcategory: string;
}

const SCENARIO_RULES: ScenarioRule[] = [
  // 1. Control Tracking -> Fingertip (40 cm/360)
  {
    test: (n) =>
      [
        "fingertip",
        "microtrack",
        "clover",
        "whisphere",
        "preciseorb",
        "thin track",
        "thin aiming",
      ].some((k) => n.includes(k)),
    category: "Control Tracking",
    subcategory: "Fingertip",
  },
  // 2. Control Tracking -> Blending (44 cm/360)
  {
    test: (n) =>
      [
        "suave",
        "blending",
        "controlsphere",
        "sphere",
        "flower",
        "smoothness",
      ].some((k) => n.includes(k)),
    category: "Control Tracking",
    subcategory: "Blending",
  },
  // 3. Control Tracking -> Arm (34 cm/360)
  {
    test: (n) =>
      [
        "smoothbot",
        "pgti",
        "air ",
        "air_",
        "air angelic",
        "air voltaic",
        "angelic",
        "ufo",
        "sky",
        "omnitrack",
        "centering i",
        "arm track",
      ].some((k) => n.includes(k)),
    category: "Control Tracking",
    subcategory: "Arm",
  },
  // 4. Reactive Tracking -> Speed (28 cm/360)
  {
    test: (n) =>
      ["bounce 180 tracking", "fast strafes", "cfsi", "switching", "switch"].some((k) =>
        n.includes(k)
      ),
    category: "Reactive Tracking",
    subcategory: "Speed",
  },
  // 5. Control Tracking -> Wrist (44 cm/360)
  {
    test: (n) =>
      [
        "smooth",
        "controltrack",
        "vt contr",
        "pilltrack",
        "edgetrack",
        "xy track",
        "xytracks",
        "tracking",
        "centering",
        "prediction",
        "cata",
        "control",
        "pressure",
        "kontr",
        "contr",
        "gentlesw",
        "curveswi",
        "dueltrac",
        "droidtra",
      ].some((k) => n.includes(k)),
    category: "Control Tracking",
    subcategory: "Wrist",
  },
  // 6. Reactive Tracking -> Control (34 cm/360)
  {
    test: (n) =>
      [
        "ground plaza",
        "plaza",
        "midrange",
        "ra close",
        "close fast",
        "bouncetr",
      ].some((k) => n.includes(k)),
    category: "Reactive Tracking",
    subcategory: "Control",
  },
  // 7. Reactive Tracking -> Reading (30 cm/360)
  {
    test: (n) =>
      ["fuglaa", "reactive", "reactiv", "straf", "longstrafes", "tam", "aether"].some(
        (k) => n.includes(k)
      ),
    category: "Reactive Tracking",
    subcategory: "Reading",
  },
  // 8. Flick Tech -> Micro (65 cm/360)
  {
    test: (n) =>
      [
        "microshot",
        "adjustshot",
        "vt adjus",
        "cartoonshot",
        "vt carto",
        "smallblinks",
        "1w1ts",
        "6 sphere",
        "hipfire",
        "cluster",
        "berry",
      ].some((k) => n.includes(k)) || /\bmicro\b/.test(n),
    category: "Flick Tech",
    subcategory: "Micro",
  },
  // 9. Flick Tech -> Post-Flick (44 cm/360)
  {
    test: (n) =>
      [
        "dotts",
        "devts",
        "patts",
        "voxts",
        "psalmts",
        "evasive",
        "kinda",
        "pokeball",
        "post-flick",
      ].some((k) => n.includes(k)) || /\bkin\b/.test(n),
    category: "Flick Tech",
    subcategory: "Post-Flick",
  },
  // 10. Flick Tech -> Stability (55 cm/360)
  {
    test: (n) =>
      [
        "multiclick",
        "hs strafe",
        "vt hs st",
        "angleshot",
        "vt angle",
        "peekshot",
        "twoshot",
        "ra twosh",
        "vt twosh",
        "fiveshot",
        "vt fives",
        "phaseshot",
        "vt phase",
      ].some((k) => n.includes(k)),
    category: "Flick Tech",
    subcategory: "Stability",
  },
  // 11. Click Timing -> Stability (50 cm/360)
  {
    test: (n) =>
      [
        "1w2ts",
        "1w3ts",
        "1w4ts",
        "linear",
        "siniclick",
        "oneshot",
        "vt onesh",
        "pattarget click",
      ].some((k) => n.includes(k)),
    category: "Click Timing",
    subcategory: "Stability",
  },
  // 12. Click Timing -> Precision (60 cm/360)
  {
    test: (n) =>
      /1w\d*te?s/.test(n) ||
      ["1wall", "2wall", "3wall", "4wall", "5wall", "6wall", "sixshot"].some((w) =>
        n.includes(w)
      ),
    category: "Click Timing",
    subcategory: "Precision",
  },
  // 13. Click Timing -> Reading (45 cm/360)
  {
    test: (n) =>
      [
        "pasu",
        "floatshot",
        "vt float",
        "floating dots",
        "popcorn",
        "popshot",
        "vt popsh",
        "b180",
        "bouncesh",
        "flyshot",
        "arc",
      ].some((k) => n.includes(k)) || /ts\b/.test(n),
    category: "Click Timing",
    subcategory: "Reading",
  },
  // 14. Flick Tech -> Speed (45 cm/360)
  {
    test: (n) =>
      [
        "wall",
        "flick",
        "reflex",
        "vex",
        "fan the hammer",
        "pistol",
        "spidershot",
        "gridshot",
        "deepflic",
      ].some((k) => n.includes(k)),
    category: "Flick Tech",
    subcategory: "Speed",
  },
  // 15. Reactive Tracking -> Speed fallback
  {
    test: (n) => ["bounce", "ground"].some((k) => n.includes(k)),
    category: "Reactive Tracking",
    subcategory: "Speed",
  },
  // 15. General Click Timing -> Precision fallback for click/shot tasks
  {
    test: (n) =>
      ["click", "vbr", "target switch", "target_speed", "plink", "shot"].some(
        (k) => n.includes(k)
      ),
    category: "Click Timing",
    subcategory: "Precision",
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
