import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Session, Task } from "../src/lib/types.ts";
import { estimateCategoryRange } from "../src/lib/lab/category-range.ts";
import { DEFAULT_VALIDITY } from "../src/lib/skill/validity.ts";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SENS = [25, 28, 31, 35, 40, 44, 49, 54, 60, 66];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Gera sessões de treino (12 runs, 2 min entre elas) com sens embaralhada. */
function buildTask(
  id: string,
  nRuns: number,
  sensList: number[],
  scoreOf: (cm: number, rand: () => number) => number,
  seed = 7,
): Task {
  const rand = rng(seed);
  const sessions: Session[] = [];
  let i = 0;
  let day = 1;
  while (i < nRuns) {
    for (let j = 0; j < 12 && i < nRuns; j++, i++) {
      const cm = sensList[Math.floor(rand() * sensList.length)];
      const minutes = j * 2;
      const dt = `2026-01-${pad(day)}T${pad(10 + Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
      sessions.push({
        id: `${id}-${i}`,
        date: dt,
        datetime: dt,
        sens: cm,
        pb: scoreOf(cm, rand),
        threshold: 0,
        sensRole: "random",
      });
    }
    day++;
  }
  return { id, name: id, category: "Tracking", subcategory: "Control", sessions };
}

const opts = { dpi: 800, validity: DEFAULT_VALIDITY };

describe("estimateCategoryRange", () => {
  it("vertice sintetico em 40 cm: centro em 36-44 e faixa contem 40", () => {
    const task = buildTask("curve", 360, SENS, (cm, r) => {
      const u = Math.log(cm / 40);
      return 1000 * (1 - 0.25 * u * u) * (1 + (r() - 0.5) * 0.02);
    });
    const res = estimateCategoryRange([task], "Tracking", "Control", opts);
    assert.ok(res.centerCm !== null, "centro nao nulo");
    assert.ok(res.centerCm >= 36 && res.centerCm <= 44, `centro = ${res.centerCm}`);
    assert.ok(res.loCm! <= 40 && res.hiCm! >= 40, `faixa = ${res.loCm}-${res.hiCm}`);
    assert.ok(res.loCm! >= 25 && res.hiCm! <= 66, "faixa recortada ao observado");
    assert.ok(res.slowPenaltyPct! > 2 && res.fastPenaltyPct! > 2);
    assert.notEqual(res.confidence, "insufficient");
    assert.equal(res.nSens >= 6, true);
  });

  it("dados planos: centro null e penalidades ~ 0", () => {
    const task = buildTask("flat", 300, SENS, (_cm, r) => 1000 * (1 + (r() - 0.5) * 0.01), 11);
    const res = estimateCategoryRange([task], "Tracking", "Control", opts);
    assert.notEqual(res.confidence, "insufficient");
    assert.equal(res.centerCm, null);
    assert.ok(res.slowPenaltyPct! < 1.5, `slow = ${res.slowPenaltyPct}`);
    assert.ok(res.fastPenaltyPct! < 1.5, `fast = ${res.fastPenaltyPct}`);
  });

  it("curva monotonica: centro null, penalidade grande na borda lenta", () => {
    const task = buildTask("mono", 300, SENS, (cm, r) => {
      const u = Math.log(cm / 40);
      return 1000 * (1 - 0.15 * u) * (1 + (r() - 0.5) * 0.01);
    }, 3);
    const res = estimateCategoryRange([task], "Tracking", "Control", opts);
    assert.equal(res.centerCm, null);
    assert.ok(res.slowPenaltyPct! > 3, `slow = ${res.slowPenaltyPct}`);
    assert.ok(res.fastPenaltyPct! < 1, `fast = ${res.fastPenaltyPct}`);
  });

  it("10 runs: insufficient com centro null", () => {
    const task = buildTask("few", 10, SENS, () => 1000);
    const res = estimateCategoryRange([task], "Tracking", "Control", opts);
    assert.equal(res.confidence, "insufficient");
    assert.equal(res.centerCm, null);
    assert.equal(res.loCm, null);
    assert.equal(res.slowPenaltyPct, null);
  });

  it("ignora outras subcategorias e exclui aquecimento (primeiras runs da sessao)", () => {
    const task = buildTask("a", 60, SENS, () => 1000, 5);
    const other: Task = { ...buildTask("b", 60, SENS, () => 1000, 6), subcategory: "Outra" };
    const res = estimateCategoryRange([task, other], "Tracking", "Control", opts);
    // 5 sessoes de 12 runs; runs nos primeiros 5 min (0,2,4 min) sao aquecimento
    assert.ok(res.nRuns < 60, `nRuns = ${res.nRuns}`);
    assert.ok(res.nRuns > 0);
  });
});
