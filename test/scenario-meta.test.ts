import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScenarioMeta,
  computeScenarioCenter,
  normalizeScenarioName,
  viscoseMedian,
  type ScenarioCenterInput,
  type ScenarioTaskInput,
} from "../src/lib/scenario-meta.ts";

const speed: ScenarioTaskInput = { name: "Flick Speed 1", category: "Flick Tech", subcategory: "Speed" };
const unknownSub: ScenarioTaskInput = { name: "Foo", category: "Flick Tech", subcategory: "Nope" };
const base: ScenarioCenterInput = { baseSensCm: 40, centerSource: "personal_relative" };

describe("scenario-meta: mediana da Viscose", () => {
  it("usa a mediana de todas as sensibilidades recomendadas (14 valores -> 44)", () => {
    assert.equal(viscoseMedian(), 44);
  });
});

describe("computeScenarioCenter por centerSource", () => {
  it("personal_relative = base * (viscose[sub] / mediana)", () => {
    // Flick Tech/Speed = 45 -> 40 * 45 / 44 = 40.909... -> 40.91
    assert.equal(computeScenarioCenter(speed, base), 40.91);
    // Click Timing/Precision = 60 -> 40 * 60 / 44 = 54.545... -> 54.55
    const precision = { name: "p", category: "Click Timing", subcategory: "Precision" };
    assert.equal(computeScenarioCenter(precision, base), 54.55);
  });

  it("viscose_absolute = VISCOSE_RECOMMENDED_SENS[cat][sub], independe da base", () => {
    const input = { ...base, centerSource: "viscose_absolute" as const };
    assert.equal(computeScenarioCenter(speed, input), 45);
    assert.equal(computeScenarioCenter(speed, { ...input, baseSensCm: 99 }), 45);
  });

  it("base = baseSensCm para qualquer cenário", () => {
    const input = { ...base, centerSource: "base" as const };
    assert.equal(computeScenarioCenter(speed, input), 40);
    const precision = { name: "p", category: "Click Timing", subcategory: "Precision" };
    assert.equal(computeScenarioCenter(precision, input), 40);
  });

  it("lab sem labCenters cai para personal_relative", () => {
    const input = { ...base, centerSource: "lab" as const };
    assert.equal(computeScenarioCenter(speed, input), 40.91);
  });

  it("lab usa labCenters[Cat/Sub] quando existe", () => {
    const input = { ...base, centerSource: "lab" as const, labCenters: { "Flick Tech/Speed": 42.5 } };
    assert.equal(computeScenarioCenter(speed, input), 42.5);
  });
});

describe("computeScenarioCenter: overrides e fallbacks", () => {
  it("centerOverrides (chave normalizada) vence qualquer fonte", () => {
    const input = {
      ...base,
      centerSource: "viscose_absolute" as const,
      centerOverrides: { "flick speed 1": 37 },
    };
    assert.equal(computeScenarioCenter(speed, input), 37);
  });

  it("override é encontrado mesmo com espaços/caixa diferentes no nome da task", () => {
    const task = { ...speed, name: "  FLICK speed 1 " };
    const input = { ...base, centerOverrides: { "flick speed 1": 37 } };
    assert.equal(computeScenarioCenter(task, input), 37);
  });

  it("subcategoria desconhecida cai na base (em todas as fontes)", () => {
    for (const centerSource of ["personal_relative", "viscose_absolute", "base", "lab"] as const) {
      assert.equal(computeScenarioCenter(unknownSub, { ...base, centerSource }), 40);
    }
  });

  it("categoria desconhecida cai na base", () => {
    const task = { name: "x", category: "Inexistente", subcategory: "Speed" };
    assert.equal(computeScenarioCenter(task, base), 40);
  });
});

describe("buildScenarioMeta", () => {
  it("monta o mapa pela chave normalizada, ignora nomes vazios e inclui categoria/subcategoria", () => {
    const meta = buildScenarioMeta(
      [speed, { name: "   ", category: "Flick Tech", subcategory: "Speed" }],
      { ...base, centerSource: "viscose_absolute" }
    );
    assert.deepEqual(Object.keys(meta), ["flick speed 1"]);
    assert.deepEqual(meta["flick speed 1"], { centerCm: 45, category: "Flick Tech", subcategory: "Speed" });
  });

  it("normalizeScenarioName faz trim + lowercase", () => {
    assert.equal(normalizeScenarioName("  Vt 1W4ts "), "vt 1w4ts");
  });
});
