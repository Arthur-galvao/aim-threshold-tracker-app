import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SensAdjustModel } from "../src/lib/skill/sens-adjust.ts";
import { classifyBasic, classifyRun, DEFAULT_VALIDITY } from "../src/lib/skill/validity.ts";
import { makeRun, T0, MIN } from "./helpers/skill-sim.ts";

const reliable: SensAdjustModel = { b: -2, reliable: true, n: 400, centerFallback: 30 };
const unreliable: SensAdjustModel = { ...reliable, reliable: false };
const cfg = DEFAULT_VALIDITY;

type R = ReturnType<typeof makeRun>;

function ctxFor(siblings: R[], model = reliable) {
  return { sessionGroup: siblings, scenarioRunsInSession: siblings, model, cfg };
}

/** Sessão com 3 runs: a primeira é aquecimento por índice e por tempo. */
function threeRuns(extra = {}): R[] {
  return [
    makeRun("t", T0, 1000, 30, extra),
    makeRun("t", T0 + 10 * MIN, 1000, 30, extra),
    makeRun("t", T0 + 20 * MIN, 1000, 30, extra),
  ];
}

describe("classifyRun", () => {
  it("1: pb <= 0 -> no_score (prioridade sobre as demais)", () => {
    const runs = threeRuns();
    const bad = makeRun("t", T0, 0, 30, { pauseDuration: 99 });
    const v = classifyRun(bad, ctxFor([bad, ...runs.slice(1)]));
    assert.equal(v.valid, false);
    assert.equal(v.reason, "no_score");
    assert.equal(v.weight, 0);
  });

  it("2: pausa longa -> paused (antes de warmup)", () => {
    const runs = threeRuns({ pauseDuration: 11 });
    assert.equal(classifyRun(runs[0], ctxFor(runs)).reason, "paused");
    const ok = threeRuns({ pauseDuration: 10 });
    assert.equal(classifyRun(ok[1], ctxFor(ok)).valid, true);
  });

  it("3: primeira run do cenário na sessão -> warmup", () => {
    const runs = threeRuns();
    assert.equal(classifyRun(runs[0], ctxFor(runs)).reason, "warmup");
    assert.equal(classifyRun(runs[1], ctxFor(runs)).valid, true);
  });

  it("3: run nos primeiros minutos da sessão global -> warmup, mesmo sendo a 2a do cenário", () => {
    const other = makeRun("o", T0, 500, 30);
    const a = makeRun("t", T0 + 2 * MIN, 1000, 30);
    const b = makeRun("t", T0 + 3 * MIN, 1000, 30);
    const late = makeRun("t", T0 + 6 * MIN, 1000, 30);
    const ctx = {
      sessionGroup: [other, a, b, late],
      scenarioRunsInSession: [a, b, late],
      model: reliable,
      cfg: { ...cfg, warmupRunsPerScenario: 0 },
    };
    assert.equal(classifyRun(a, ctx).reason, "warmup");
    assert.equal(classifyRun(b, ctx).reason, "warmup");
    assert.equal(classifyRun(late, ctx).valid, true);
  });

  it("legado sem datetime: so o indice conta", () => {
    const mk = (i: number) => {
      const r = makeRun("t", T0 + i, 1000, 30);
      delete (r.session as { datetime?: string }).datetime;
      return r;
    };
    const runs = [mk(0), mk(1)];
    assert.equal(classifyRun(runs[0], ctxFor(runs, unreliable)).reason, "warmup");
    assert.equal(classifyRun(runs[1], ctxFor(runs, unreliable)).valid, true);
  });

  it("4: base/anchor/off validas com peso 1 e y bruto, mesmo fora da banda", () => {
    for (const role of ["base", "anchor", "off"] as const) {
      const runs = threeRuns({ sens: 45, sensRole: role, rollCenterCm: 30 });
      const v = classifyRun(runs[1], ctxFor(runs, unreliable));
      assert.equal(v.valid, true);
      assert.equal(v.weight, 1);
      assert.equal(v.y, Math.log(1000));
    }
  });

  it("4: dentro da banda (+-5%) e valida bruta mesmo com role random", () => {
    const runs = threeRuns({ sens: 31, sensRole: "random", rollCenterCm: 30 });
    const v = classifyRun(runs[1], ctxFor(runs, unreliable));
    assert.equal(v.valid, true);
    assert.equal(v.weight, 1);
    assert.equal(v.y, Math.log(1000));
  });

  it("5: fora da banda com modelo confiavel -> ajustada, peso 0.6", () => {
    const runs = threeRuns({ sens: 30 * Math.exp(0.2), sensRole: "random", rollCenterCm: 30 });
    const v = classifyRun(runs[1], ctxFor(runs, reliable));
    assert.equal(v.valid, true);
    assert.equal(v.weight, 0.6);
    assert.ok(Math.abs(v.y - (Math.log(1000) + 2 * 0.04)) < 1e-12);
  });

  it("5: fora da banda sem modelo confiavel (legado unknown) -> off_center_unadjustable", () => {
    const runs = threeRuns({ sens: 45, rollCenterCm: 30 });
    const v = classifyRun(runs[1], ctxFor(runs, unreliable));
    assert.equal(v.valid, false);
    assert.equal(v.reason, "off_center_unadjustable");
  });

  it("5: sem rollCenterCm usa centerFallback do modelo", () => {
    const runs = threeRuns({ sens: 45 });
    assert.equal(classifyRun(runs[1], ctxFor(runs, reliable)).weight, 0.6);
    const near = threeRuns({ sens: 30.5 });
    assert.equal(classifyRun(near[1], ctxFor(near, unreliable)).valid, true);
  });

  it("6: measure aumenta o peso (cap 1.25)", () => {
    const base = threeRuns({ sensRole: "base", runMode: "measure" });
    assert.equal(classifyRun(base[1], ctxFor(base)).weight, 1.25);
    const adj = threeRuns({ sens: 30 * Math.exp(0.2), sensRole: "random", rollCenterCm: 30, runMode: "measure" });
    assert.ok(Math.abs(classifyRun(adj[1], ctxFor(adj)).weight - 0.75) < 1e-12);
    const train = threeRuns({ sensRole: "base", runMode: "train" });
    assert.equal(classifyRun(train[1], ctxFor(train)).weight, 1);
  });
});

describe("classifyBasic", () => {
  it("devolve null quando passa nas regras 1-3 e nao olha sens", () => {
    const runs = threeRuns({ sens: 999 });
    assert.equal(classifyBasic(runs[1], ctxFor(runs)), null);
    assert.equal(classifyBasic(runs[0], ctxFor(runs))?.reason, "warmup");
  });
});
