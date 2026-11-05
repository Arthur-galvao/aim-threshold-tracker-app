import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSessionSummary, sessionZs, type SummaryScenario } from "../src/lib/skill/session-summary.ts";
import type { RunRef } from "../src/lib/skill/sessions.ts";
import type { SkillSummary, SkillRunInfo, SkillPoint } from "../src/lib/skill/skill-model.ts";
import type { Session } from "../src/lib/types.ts";

const MIN = 60_000;
const KEY = "2026-11-05T10:00:00.000Z";
const T0 = Date.parse("2026-11-05T10:00:00");

function sess(id: string, focus: "on" | "auto" | null = null, t = T0): Session {
  return { id, date: "2026-11-05", sens: 40, pb: 100, threshold: 0, datetime: new Date(t).toISOString().slice(0, 19), focus } as Session;
}

function run(sessionId: string, t: number, valid: boolean, y: number, reason?: "warmup" | "paused"): SkillRunInfo {
  return {
    sessionId,
    t,
    score: Math.exp(y),
    sens: 40,
    sessionKey: KEY,
    validity: valid ? { valid: true, weight: 1, y } : { valid: false, weight: 0, reason, y },
  };
}

function point(over: Partial<SkillPoint> = {}): SkillPoint {
  return {
    sessionKey: KEY,
    startedAt: T0,
    nValid: 2,
    sessionValue: 4.6,
    muBefore: 4.5,
    sigma: 0.05,
    target: 100,
    stretch: 120,
    hit: true,
    muAfter: 4.6,
    ...over,
  };
}

function skill(runs: SkillRunInfo[], points: SkillPoint[], trend: SkillSummary["trend"] = "flat", hitRate14: number | null = 0.5): SkillSummary {
  return {
    points,
    mu: null,
    sigma: null,
    cv: null,
    nextTarget: null,
    nextStretch: null,
    pb: null,
    hitRate14,
    trend,
    trendSlopePct: null,
    difficultyHint: null,
    model: {} as SkillSummary["model"],
    runs,
    invalidCounts: {},
  };
}

const sessions = [sess("a", "on"), sess("b", "auto"), sess("c", "on")];
const scenarioA: SummaryScenario = {
  taskId: "A",
  name: "Alpha",
  category: "Flick Tech",
  subcategory: "Speed",
  sessions,
  skill: skill(
    [
      run("a", T0, true, 4.6),
      run("b", T0 + MIN, true, 4.7),
      run("c", T0 + 2 * MIN, false, 4.0, "warmup"),
    ],
    [point()],
    "down",
    0.2,
  ),
};
const scenarioB: SummaryScenario = {
  taskId: "B",
  name: "Beta",
  category: "Click Timing",
  subcategory: "Precision",
  sessions: [sess("d", null)],
  skill: skill([run("d", T0 + 3 * MIN, true, 4.4)], [point({ hit: false, muAfter: 4.45, muBefore: 4.5, sessionValue: 4.4 })], "flat", 0.7),
};
const group: RunRef[] = [
  { taskId: "A", session: sessions[0], t: T0 },
  { taskId: "A", session: sessions[1], t: T0 + MIN },
  { taskId: "A", session: sessions[2], t: T0 + 2 * MIN },
  { taskId: "B", session: { ...sessions[0], id: "d" }, t: T0 + 3 * MIN },
];

describe("buildSessionSummary", () => {
  it("conta runs, válidas e motivos das inválidas por cenário", () => {
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA, scenarioB], nowMs: T0 + 10 * MIN, live: false });
    assert.equal(s.runs, 4);
    assert.equal(s.validRuns, 3);
    assert.deepEqual(s.invalidReasons, { warmup: 1 });
    const alpha = s.scenarios.find((r) => r.taskId === "A");
    assert.ok(alpha);
    assert.equal(alpha.runs, 3);
    assert.equal(alpha.validRuns, 2);
    assert.deepEqual(alpha.invalidReasons, { warmup: 1 });
  });

  it("melhor score ajustado é exp(max y) das válidas e usa meta/hit do ponto da sessão", () => {
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA], nowMs: T0, live: false });
    const row = s.scenarios[0];
    assert.ok(Math.abs((row.bestScore ?? 0) - Math.exp(4.7)) < 1e-9);
    assert.equal(row.target, 100);
    assert.equal(row.hit, true);
    assert.ok(Math.abs((row.deltaMuPct ?? 0) - (Math.exp(0.1) - 1) * 100) < 1e-9);
  });

  it("Δμ e hit de sessão sem valor/primeira sessão", () => {
    const first = { ...scenarioB, skill: skill(scenarioB.skill.runs, [point({ hit: null, sessionValue: null, muAfter: 4.5, muBefore: 4.5 })]) };
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [first], nowMs: T0, live: false });
    assert.equal(s.scenarios[0].hit, null);
    assert.equal(s.scenarios[0].deltaMuPct, null);
  });

  it("% foco = on / (on + auto) sobre runs válidas com ratings", () => {
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA, scenarioB], nowMs: T0, live: false });
    // A: a(on, válida) b(auto, válida); c é inválida. B: d sem foco.
    assert.equal(s.focusOnRuns, 1);
    assert.equal(s.focusAutoRuns, 1);
    assert.equal(s.focusOnShare, 0.5);
  });

  it("% foco null sem ratings", () => {
    const noFocus = { ...scenarioA, sessions: sessions.map((x) => ({ ...x, focus: null })) };
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [noFocus], nowMs: T0, live: false });
    assert.equal(s.focusOnShare, null);
  });

  it("duração: sessão aberta vai até agora; fechada, até a última run", () => {
    const closed = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA], nowMs: T0 + 60 * MIN, live: false });
    assert.equal(Math.round(closed.durationMin), 3);
    const live = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA], nowMs: T0 + 20 * MIN, live: true });
    assert.equal(Math.round(live.durationMin), 20);
  });

  it("conta alertas de fadiga disparados", () => {
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA], nowMs: T0, live: false, fatigueAlertTimes: [T0 + 40 * MIN, T0 + 60 * MIN] });
    assert.equal(s.fatigueAlerts, 2);
  });

  it("próxima sugestão: primeira fraqueza com sugestão (refine se hit < 35%)", () => {
    const s = buildSessionSummary({ sessionKey: KEY, group, scenarios: [scenarioA, scenarioB], nowMs: T0 + MIN, live: true });
    assert.ok(s.nextSuggestion);
    assert.equal(s.nextSuggestion.subcategory, "Speed");
    assert.equal(s.nextSuggestion.suggestion, "refine");
  });

  it("sem sugestão quando nenhum cenário qualifica", () => {
    const easy = { ...scenarioA, skill: skill([], [], "up", 0.5) };
    const s = buildSessionSummary({ sessionKey: KEY, group: [], scenarios: [easy], nowMs: T0, live: true });
    assert.equal(s.nextSuggestion, null);
    assert.equal(s.runs, 0);
  });
});

describe("sessionZs", () => {
  it("z = (y − μ_antes)/σ, só válidas da sessão, em ordem cronológica", () => {
    const zs = sessionZs([scenarioA, scenarioB], KEY);
    assert.equal(zs.length, 3);
    assert.deepEqual(zs.map((z) => z.t), [...zs.map((z) => z.t)].sort((a, b) => a - b));
    const first = zs.find((z) => z.t === T0);
    assert.ok(first);
    assert.ok(Math.abs(first.z - (4.6 - 4.5) / 0.05) < 1e-9);
  });

  it("ignora sessões de outra chave e σ não positivo", () => {
    const flat = { ...scenarioA, skill: skill(scenarioA.skill.runs, [point({ sigma: 0 })]) };
    assert.deepEqual(sessionZs([flat], KEY), []);
    assert.deepEqual(sessionZs([scenarioA], "outra"), []);
  });
});
