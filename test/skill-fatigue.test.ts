import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldAlertFatigue, type FatigueInput } from "../src/lib/skill/fatigue.ts";

const MIN = 60_000;
const BASE: FatigueInput = {
  sessionStartMs: 0,
  nowMs: 40 * MIN,
  zs: [0.5, -1.8, -1.9, -2.0, -1.6],
  lastAlertMs: null,
  enabled: true,
};

describe("shouldAlertFatigue", () => {
  it("dispara com sessão ≥ 30 min, pico (z ≥ 0) e média das últimas 4 < −1.5", () => {
    assert.equal(shouldAlertFatigue(BASE), true);
  });

  it("respeita enabled = false", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, enabled: false }), false);
  });

  it("sessão com menos de 30 min não dispara", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, nowMs: 29 * MIN }), false);
  });

  it("exatamente 30 min já conta", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, nowMs: 30 * MIN }), true);
  });

  it("sem pico (nenhum z ≥ 0) não dispara", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [-0.5, -1.8, -1.9, -2.0, -1.6] }), false);
  });

  it("pico em qualquer ponto da sessão (não só nas últimas runs) basta", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [0, -2, -2, -2, -2] }), true);
  });

  it("menos de 4 runs válidas não dispara", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [1, -3, -3] }), false);
  });

  it("média das últimas 4 exatamente −1.5 não dispara (estritamente menor)", () => {
    // média de [-1.5 ×4] = −1.5
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [1, -1.5, -1.5, -1.5, -1.5] }), false);
  });

  it("usa só as últimas 4: queda antiga com recuperação recente não dispara", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [1, -3, -3, 0, 0.5, 0.5, 0.5, 0.5] }), false);
  });

  it("cooldown de 15 min bloqueia; após 15 min libera", () => {
    const lastAlertMs = 30 * MIN;
    assert.equal(shouldAlertFatigue({ ...BASE, lastAlertMs, nowMs: 44 * MIN }), false);
    assert.equal(shouldAlertFatigue({ ...BASE, lastAlertMs, nowMs: 45 * MIN }), true);
  });

  it("zs não finitos são ignorados", () => {
    assert.equal(shouldAlertFatigue({ ...BASE, zs: [1, Number.NaN, -2, -2, -2, -2] }), true);
  });
});
