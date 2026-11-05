import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SkillPoint, SkillRunInfo, SkillSummary } from "../src/lib/skill/skill-model.ts";
import { sessionKey, type RunRef } from "../src/lib/skill/sessions.ts";
import { intraSessionCurve } from "../src/lib/skill/intra-session.ts";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

/**
 * Sessão de um único cenário com um z por run (null = run inválida).
 * y = z·σ + μ, então (y − μ)/σ recupera z.
 */
function makeSession(k: number, taskId: string, zs: Array<number | null>, sigma = 1, muBefore = 0) {
  const t0 = START + k * DAY;
  const group: RunRef[] = zs.map((_, i) => ({
    taskId,
    session: { id: `s${k}-${i}`, date: "2026-01-01", sens: 1, pb: 100, threshold: 0 },
    t: t0 + i * 60_000,
  }));
  const key = sessionKey(group);
  const runs: SkillRunInfo[] = zs.map((z, i) => ({
    sessionId: `s${k}-${i}`,
    t: t0 + i * 60_000,
    score: 100,
    sens: 1,
    sessionKey: key,
    validity:
      z === null
        ? { valid: false, weight: 0, reason: "warmup", y: Number.NaN }
        : { valid: true, weight: 1, y: z * sigma + muBefore },
  }));
  const point: SkillPoint = {
    sessionKey: key,
    startedAt: t0,
    nValid: zs.filter((z) => z !== null).length,
    sessionValue: muBefore,
    muBefore,
    sigma,
    target: 1,
    stretch: 1,
    hit: null,
    muAfter: muBefore,
  };
  return { group, runs, point };
}

/** Skill mínimo (só os campos usados pela curva) para um taskId. */
function fakeSkill(parts: Array<ReturnType<typeof makeSession>>): SkillSummary {
  return { points: parts.map((p) => p.point), runs: parts.flatMap((p) => p.runs) } as unknown as SkillSummary;
}

function build(zsPerSession: Array<Array<number | null>>, taskId = "t1") {
  const parts = zsPerSession.map((zs, k) => makeSession(k, taskId, zs));
  const sessions = parts.map((p) => p.group);
  const skills = new Map<string, SkillSummary>([[taskId, fakeSkill(parts)]]);
  return { skills, sessions };
}

describe("intraSessionCurve: z e índices", () => {
  it("z = (y − μ_antes)/σ por run, índice = posição na sessão", () => {
    const parts = [makeSession(0, "t1", [1, -2], 0.5, -2)];
    // y = z·0.5 + (-2): z=1 → y=-1.5 ; z=-2 → y=-3
    const skills = new Map([["t1", fakeSkill(parts)]]);
    const curve = intraSessionCurve(skills, [parts[0].group], 20);
    assert.deepEqual(curve.byIndex, [
      { index: 0, meanZ: 1, n: 1 },
      { index: 1, meanZ: -2, n: 1 },
    ]);
  });

  it("média de z por índice entre sessões; runs inválidas ocupam índice mas não entram na média", () => {
    const { skills, sessions } = build([
      [null, 1, 0],
      [0, 3, 2],
    ]);
    const curve = intraSessionCurve(skills, sessions, 20);
    assert.deepEqual(curve.byIndex, [
      { index: 0, meanZ: 0, n: 1 },
      { index: 1, meanZ: 2, n: 2 },
      { index: 2, meanZ: 1, n: 2 },
    ]);
  });

  it("runs sem skill ou sem ponto de sessão são ignoradas", () => {
    const parts = [makeSession(0, "t1", [1, 1])];
    const skills = new Map([["t1", fakeSkill(parts)]]);
    const other: RunRef[] = [
      { taskId: "t2", session: { id: "x", date: "2026-01-01", sens: 1, pb: 1, threshold: 0 }, t: START },
    ];
    const curve = intraSessionCurve(skills, [parts[0].group, other], 20);
    assert.deepEqual(
      curve.byIndex.map((b) => b.n),
      [1, 1],
    );
  });

  it("σ não positivo ou y não finito → run ignorada", () => {
    const parts = [makeSession(0, "t1", [1], 0)];
    const curve = intraSessionCurve(new Map([["t1", fakeSkill(parts)]]), [parts[0].group], 20);
    assert.deepEqual(curve.byIndex, []);
  });

  it("considera só as últimas lastN sessões", () => {
    const zs: Array<Array<number | null>> = [[5]];
    for (let i = 0; i < 20; i++) zs.push([0]);
    const { skills, sessions } = build(zs);
    const curve = intraSessionCurve(skills, sessions, 20);
    assert.deepEqual(curve.byIndex, [{ index: 0, meanZ: 0, n: 20 }]);
  });

  it("lastN = 0 → vazio e sem sugestão", () => {
    const { skills, sessions } = build([[0, 0, 0]]);
    assert.deepEqual(intraSessionCurve(skills, sessions, 0), { byIndex: [], suggestedWarmupRuns: null });
  });

  it("sessões vazias e Map vazio não quebram", () => {
    assert.deepEqual(intraSessionCurve(new Map(), [], 20), { byIndex: [], suggestedWarmupRuns: null });
  });
});

describe("intraSessionCurve: sugestão de aquecimento", () => {
  // Três sessões idênticas: média por índice = padrão abaixo.
  const pattern = [-1, -0.5, -0.1, 0, 0.1, 0.2];

  it("primeiro índice com média ≥ −0.25 e as 3 seguintes também", () => {
    const { skills, sessions } = build([pattern, pattern, pattern]);
    const curve = intraSessionCurve(skills, sessions, 20);
    assert.equal(curve.suggestedWarmupRuns, 2);
    const rounded = curve.byIndex.map((b) => Math.round(b.meanZ * 1e9) / 1e9);
    assert.deepEqual(rounded, pattern);
  });

  it("se um dos 3 seguintes cai abaixo do limiar, não conta como estabilizado", () => {
    const bad = [-1, -0.1, 0, -0.5, 0.1, 0.2, 0.3];
    const { skills, sessions } = build([bad, bad, bad]);
    const curve = intraSessionCurve(skills, sessions, 20);
    // índice 1 (−0.1) seguido de 2,3(−0.5)… falha; índice 4 (0.1) com 5,6,7 → 7 não existe
    assert.equal(curve.suggestedWarmupRuns, null);
  });

  it("curva que nunca estabiliza → null", () => {
    const { skills, sessions } = build([[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]]);
    assert.equal(intraSessionCurve(skills, sessions, 20).suggestedWarmupRuns, null);
  });

  it("índice com menos de 3 amostras não conta para a estabilização", () => {
    // Só uma sessão: n = 1 em cada índice → nenhum índice qualifica mesmo com z alto.
    const { skills, sessions } = build([[2, 2, 2, 2, 2, 2]]);
    const curve = intraSessionCurve(skills, sessions, 20);
    assert.equal(curve.suggestedWarmupRuns, null);
    assert.ok(curve.byIndex.every((b) => b.n === 1));
  });

  it("curva estável desde o início → sugestão 0", () => {
    const { skills, sessions } = build([[0, 0.1, 0.2, 0.3], [0, 0.1, 0.2, 0.3], [0, 0.1, 0.2, 0.3]]);
    assert.equal(intraSessionCurve(skills, sessions, 20).suggestedWarmupRuns, 0);
  });
});
