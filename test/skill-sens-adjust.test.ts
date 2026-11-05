import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupTrainingSessions, type RunRef } from "../src/lib/skill/sessions.ts";
import { fitSensAdjust, adjustLogScore, targetAtSens } from "../src/lib/skill/sens-adjust.ts";
import { mulberry32, gaussian, makeRun, T0, DAY, MIN } from "./helpers/skill-sim.ts";

const CENTER = 30;

function simulate(nSessions: number, perSession: number, trendPerSession: number, seed: number): RunRef[] {
  const rng = mulberry32(seed);
  const runs: RunRef[] = [];
  for (let s = 0; s < nSessions; s++) {
    // viés de sens crescente com as sessões: correlaciona com a tendência temporal de habilidade
    const bias = (s / nSessions) * 0.15;
    for (let i = 0; i < perSession; i++) {
      const d = bias + (rng() * 2 - 1) * 0.25;
      const sens = CENTER * Math.exp(d);
      const y = Math.log(1000) + trendPerSession * s + -2.0 * d * d + 0.05 * gaussian(rng);
      runs.push(makeRun("t", T0 + s * DAY + i * 3 * MIN, Math.exp(y), sens, { rollCenterCm: CENTER, sensRole: "random" }));
    }
  }
  return runs;
}

describe("fitSensAdjust", () => {
  it("recupera b ≈ -2 apesar de tendência temporal correlacionada com a sens", () => {
    const runs = simulate(40, 10, 0.003, 42);
    const groups = groupTrainingSessions(runs);
    const m = fitSensAdjust(runs, groups);
    assert.equal(m.reliable, true);
    assert.ok(m.b > -2.6 && m.b < -1.4, `b=${m.b}`);
    assert.ok(m.n >= 300);
  });

  it("com 20 runs não é confiável", () => {
    const runs = simulate(2, 10, 0, 7);
    const m = fitSensAdjust(runs, groupTrainingSessions(runs));
    assert.equal(m.reliable, false);
    assert.ok(m.n <= 20);
  });

  it("sem runs devolve modelo neutro", () => {
    const m = fitSensAdjust([], []);
    assert.deepEqual(m, { b: 0, reliable: false, n: 0, centerFallback: 0 });
  });

  it("sem variação de sens nunca é confiável e b = 0", () => {
    const rng = mulberry32(3);
    const runs: RunRef[] = [];
    for (let s = 0; s < 20; s++)
      for (let i = 0; i < 5; i++)
        runs.push(makeRun("t", T0 + s * DAY + i * 3 * MIN, 1000 * Math.exp(0.05 * gaussian(rng)), CENTER));
    const m = fitSensAdjust(runs, groupTrainingSessions(runs));
    assert.equal(m.reliable, false);
    assert.equal(m.b, 0);
    assert.equal(m.centerFallback, CENTER);
  });

  it("b nunca é positivo", () => {
    const rng = mulberry32(5);
    const runs: RunRef[] = [];
    for (let s = 0; s < 40; s++)
      for (let i = 0; i < 10; i++) {
        const d = (rng() * 2 - 1) * 0.25;
        const y = Math.log(1000) + 3 * d * d + 0.02 * gaussian(rng);
        runs.push(makeRun("t", T0 + s * DAY + i * 3 * MIN, Math.exp(y), CENTER * Math.exp(d), { rollCenterCm: CENTER }));
      }
    const m = fitSensAdjust(runs, groupTrainingSessions(runs));
    assert.ok(m.b <= 0);
  });
});

describe("adjustLogScore / targetAtSens", () => {
  const m = { b: -2, reliable: true, n: 400, centerFallback: CENTER };

  it("corrige y para o centro e limita a ln(1.25)", () => {
    const sens = CENTER * Math.exp(0.2);
    assert.ok(Math.abs(adjustLogScore(5, sens, CENTER, m) - (5 + 2 * 0.04)) < 1e-12);
    const far = CENTER * Math.exp(1);
    assert.ok(Math.abs(adjustLogScore(5, far, CENTER, m) - (5 + Math.log(1.25))) < 1e-12);
  });

  it("no centro não muda nada; modelo não confiável é no-op", () => {
    assert.equal(adjustLogScore(5, CENTER, CENTER, m), 5);
    assert.equal(adjustLogScore(5, 40, CENTER, { ...m, reliable: false }), 5);
    assert.equal(targetAtSens(100, 40, CENTER, { ...m, reliable: false }), 100);
  });

  it("targetAtSens reduz a meta fora do centro e é inverso de adjustLogScore", () => {
    const sens = CENTER * Math.exp(0.2);
    const t = targetAtSens(100, sens, CENTER, m);
    assert.ok(t < 100);
    assert.ok(Math.abs(Math.log(t) + (adjustLogScore(0, sens, CENTER, m)) - Math.log(100)) < 1e-12);
    assert.equal(targetAtSens(100, CENTER, CENTER, m), 100);
  });

  it("entradas inválidas não quebram", () => {
    assert.equal(adjustLogScore(5, 0, CENTER, m), 5);
    assert.equal(targetAtSens(100, 30, 0, m), 100);
  });
});
