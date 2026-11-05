import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { focusBreakdown } from "../src/lib/skill/focus-stats.ts";
import type { SkillPoint, SkillRunInfo, SkillSummary } from "../src/lib/skill/skill-model.ts";
import type { Session, SessionFocus } from "../src/lib/types.ts";

function run(sessionId: string, sessionKey: string, y: number, valid = true): SkillRunInfo {
  return {
    sessionId,
    t: 0,
    score: Math.exp(y),
    sens: 1,
    sessionKey,
    validity: { valid, weight: 1, y, ...(valid ? {} : { reason: "warmup" as const }) },
  } as SkillRunInfo;
}

function point(sessionKey: string, hit: boolean | null): SkillPoint {
  return { sessionKey, hit } as SkillPoint;
}

function session(id: string, focus: SessionFocus | undefined): Session {
  return { id, date: "2026-01-01", sens: 1, pb: 1, threshold: 1, focus } as Session;
}

describe("focusBreakdown", () => {
  it("separa runs válidas on/auto e ignora focus null e runs inválidas", () => {
    const summary = {
      runs: [
        run("a", "k1", 4.0),
        run("b", "k1", 4.2),
        run("c", "k2", 3.0),
        run("d", "k2", 9.9, false),
        run("e", "k3", 5.0),
      ],
      points: [point("k1", true), point("k2", false), point("k3", null)],
    } as unknown as SkillSummary;
    const sessions = [
      session("a", "on"),
      session("b", "on"),
      session("c", "auto"),
      session("d", "on"),
      session("e", null),
    ];

    const r = focusBreakdown(summary, sessions);
    assert.equal(r.on.n, 2);
    assert.equal(r.auto.n, 1);
    assert.ok(Math.abs((r.on.meanY ?? NaN) - 4.1) < 1e-9);
    assert.equal(r.auto.meanY, 3.0);
  });

  it("hitRate conta sessões distintas com hit definido", () => {
    const summary = {
      runs: [run("a", "k1", 1), run("b", "k1", 1), run("c", "k2", 1), run("d", "k3", 1)],
      points: [point("k1", true), point("k2", false), point("k3", null)],
    } as unknown as SkillSummary;
    const sessions = [session("a", "on"), session("b", "on"), session("c", "on"), session("d", "on")];

    const r = focusBreakdown(summary, sessions);
    assert.equal(r.on.n, 4);
    assert.equal(r.on.hitRate, 0.5); // k1 (hit) e k2 (miss); k3 sem hit definido fica fora
    assert.equal(r.auto.hitRate, null);
  });

  it("grupo vazio devolve n 0, meanY e hitRate null", () => {
    const summary = { runs: [], points: [] } as unknown as SkillSummary;
    const r = focusBreakdown(summary, []);
    assert.deepEqual(r, {
      on: { n: 0, meanY: null, hitRate: null },
      auto: { n: 0, meanY: null, hitRate: null },
    });
  });

  it("y não finito não entra na média mas conta como run", () => {
    const summary = {
      runs: [run("a", "k1", 2), run("b", "k1", Number.NaN)],
      points: [point("k1", true)],
    } as unknown as SkillSummary;
    const r = focusBreakdown(summary, [session("a", "auto"), session("b", "auto")]);
    assert.equal(r.auto.n, 2);
    assert.equal(r.auto.meanY, 2);
    assert.equal(r.auto.hitRate, 1);
  });
});
