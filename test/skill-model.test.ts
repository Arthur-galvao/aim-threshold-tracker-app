import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../src/lib/types.ts";
import type { RunRef } from "../src/lib/skill/sessions.ts";
import { computeSkill, DEFAULT_TARGET, successProbFor, type SkillSummary } from "../src/lib/skill/skill-model.ts";
import { DEFAULT_VALIDITY } from "../src/lib/skill/validity.ts";
import { mulberry32, gaussian, makeRun, T0, DAY, MIN } from "./helpers/skill-sim.ts";

const SENS = 30;
const cfg = { validity: DEFAULT_VALIDITY, target: DEFAULT_TARGET };

function taskOf(id: string): Task {
  return { id, name: id, category: "c", subcategory: "s", sessions: [] };
}

interface SimOpts {
  sessions: number;
  runsPerSession: number;
  /** log-habilidade verdadeira na sessão s */
  muAt: (s: number) => number;
  sigma: number;
  seed: number;
  /** dias entre sessões */
  gapDays?: number;
  /** override pontual do instante da sessão (dias desde T0) */
  dayAt?: (s: number) => number;
  /** y adicional em uma sessão (outlier) */
  bump?: (s: number) => number;
}

/** Runs de um cenário: runs a cada 6 min a partir do início da sessão (a 1a é aquecimento). */
function simulate(taskId: string, o: SimOpts): RunRef[] {
  const rng = mulberry32(o.seed);
  const runs: RunRef[] = [];
  for (let s = 0; s < o.sessions; s++) {
    const day = o.dayAt ? o.dayAt(s) : s * (o.gapDays ?? 1);
    for (let i = 0; i < o.runsPerSession; i++) {
      const y = o.muAt(s) + (o.bump?.(s) ?? 0) + o.sigma * gaussian(rng);
      runs.push(makeRun(taskId, T0 + day * DAY + i * 6 * MIN, Math.exp(y), SENS, { sensRole: "base" }));
    }
  }
  return runs;
}

function run(taskId: string, runs: RunRef[], now: number, extra: Partial<typeof cfg> = {}): SkillSummary {
  return computeSkill(taskOf(taskId), runs, { ...cfg, ...extra }, now);
}

const BASE = Math.log(1000);

describe("computeSkill: simulacoes", () => {
  it("queda de 5% depois de 20 sessoes em alta: nextTarget cai em ate 4 sessoes", () => {
    const o: SimOpts = {
      sessions: 24,
      runsPerSession: 4,
      sigma: 0.04,
      seed: 11,
      muAt: (s) => BASE + (s < 20 ? 0.01 * s : 0.01 * 19) + (s >= 20 ? Math.log(0.95) : 0),
    };
    const all = simulate("t", o);
    const nextAfter = (nSessions: number) => {
      const upTo = all.filter((r) => r.t < T0 + nSessions * DAY - 12 * 60 * MIN);
      return run("t", upTo, T0 + (nSessions - 1) * DAY + 2 * 60 * MIN).nextTarget!;
    };
    const before = nextAfter(20);
    const afterDrop = [21, 22, 23, 24].map(nextAfter);
    assert.ok(Math.min(...afterDrop) < before, `before=${before} after=${afterDrop}`);
  });

  it("outlier +40% em uma sessao sobe mu menos que 1.5 sigma", () => {
    const base: SimOpts = { sessions: 30, runsPerSession: 4, sigma: 0.04, seed: 5, muAt: () => BASE };
    const clean = run("t", simulate("t", base), T0 + 40 * DAY);
    const dirty = run("t", simulate("t", { ...base, bump: (s) => (s === 29 ? Math.log(1.4) : 0) }), T0 + 40 * DAY);
    const delta = Math.log(dirty.mu!) - Math.log(clean.mu!);
    assert.ok(delta > 0, `delta=${delta}`);
    assert.ok(delta < 1.5 * dirty.sigma!, `delta=${delta} sigma=${dirty.sigma}`);
  });

  it("regime estavel (successProb 0.6, plannedRuns 5, 60 sessoes): hitRate entre 0.45 e 0.75", () => {
    const rates: number[] = [];
    for (const seed of [21, 22, 23, 24, 25]) {
      const all = simulate("t", { sessions: 60, runsPerSession: 4, sigma: 0.05, seed, muAt: () => BASE });
      const sum = run("t", all, T0 + 61 * DAY);
      const hits = sum.points.filter((p) => p.hit !== null);
      rates.push(hits.filter((p) => p.hit).length / hits.length);
    }
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    assert.ok(avg > 0.45 && avg < 0.75, `rates=${rates} avg=${avg}`);
    const single = run("t", simulate("t", { sessions: 60, runsPerSession: 4, sigma: 0.05, seed: 21, muAt: () => BASE }), T0 + 61 * DAY);
    assert.ok(single.hitRate14 !== null);
  });

  it("30 dias parado: nextTarget menor que a meta antes da pausa", () => {
    const all = simulate("t", { sessions: 30, runsPerSession: 4, sigma: 0.05, seed: 9, muAt: () => BASE });
    const lastDay = 29;
    const just = run("t", all, T0 + lastDay * DAY + 2 * 60 * MIN).nextTarget!;
    const paused = run("t", all, T0 + (lastDay + 30) * DAY).nextTarget!;
    assert.ok(paused < just, `just=${just} paused=${paused}`);
  });

  it("cenario com 4 runs: nao quebra e trend insufficient", () => {
    const all = simulate("t", { sessions: 1, runsPerSession: 4, sigma: 0.05, seed: 1, muAt: () => BASE });
    const sum = run("t", all, T0 + DAY);
    assert.equal(sum.trend, "insufficient");
    assert.equal(sum.trendSlopePct, null);
    assert.equal(sum.points.length, 1);
    assert.equal(sum.points[0].hit, null);
    assert.ok(sum.nextTarget! > 0);
    assert.equal(sum.runs.length, 4);
  });
});

describe("computeSkill: regras", () => {
  it("sem runs: tudo nulo e sem excecao", () => {
    const sum = run("t", [], T0);
    assert.equal(sum.mu, null);
    assert.equal(sum.nextTarget, null);
    assert.equal(sum.pb, null);
    assert.equal(sum.hitRate14, null);
    assert.equal(sum.trend, "insufficient");
    assert.deepEqual(sum.points, []);
  });

  it("primeira sessao: mu = valor da sessao e hit null", () => {
    const runs = [1000, 800, 900, 880].map((pb, i) => makeRun("t", T0 + i * 6 * MIN, pb, SENS, { sensRole: "base" }));
    const sum = run("t", runs, T0 + DAY);
    // valida: 800 (idx0 e aquecimento), 900, 880, ... runs idx1..3 = 800? idx0=1000 aquecimento
    const p = sum.points[0];
    assert.equal(p.hit, null);
    assert.equal(p.nValid, 3);
    assert.ok(Math.abs(p.sessionValue! - Math.log(880)) < 1e-12); // mediana de {900,880,800}
    assert.equal(p.muAfter, p.sessionValue);
    assert.equal(sum.pb, 1000);
  });

  it("sigma segue o prior 0.06 sem historico e respeita clamp", () => {
    const runs = [1000, 1000, 1000, 1000].map((pb, i) => makeRun("t", T0 + i * 6 * MIN, pb, SENS, { sensRole: "base" }));
    const sum = run("t", runs, T0 + DAY);
    assert.ok(Math.abs(sum.points[0].sigma - 0.06) < 1e-12);
    const noisy = simulate("t", { sessions: 40, runsPerSession: 4, sigma: 0.6, seed: 2, muAt: () => BASE });
    assert.ok(run("t", noisy, T0 + 50 * DAY).sigma! <= 0.25);
    const flat = simulate("t", { sessions: 40, runsPerSession: 4, sigma: 0, seed: 2, muAt: () => BASE });
    assert.ok(Math.abs(run("t", flat, T0 + 41 * DAY).sigma! - 0.015) < 1e-12);
  });

  it("agrupamento global: aquecimento em outro cenario invalida runs cedo do cenario", () => {
    const other = makeRun("o", T0, 500, SENS, { sensRole: "base" });
    const mine = [0, 1, 2, 3].map((i) => makeRun("t", T0 + (2 + i * 2) * MIN, 1000, SENS, { sensRole: "base" }));
    const sum = run("t", [other, ...mine], T0 + DAY);
    // runs em 2 e 4 min (<5min do inicio da sessao global, que comeca em 0) sao aquecimento
    const warm = sum.runs.filter((r) => r.validity.reason === "warmup").length;
    assert.equal(warm, 2);
    assert.equal(sum.invalidCounts.warmup, 2);
    assert.equal(sum.runs.length, 4);
    assert.ok(sum.runs.every((r) => r.sessionKey === sum.points[0].sessionKey));
  });

  it("gapMinutes configuravel separa sessoes", () => {
    const rs = [0, 1, 2, 3, 4, 5].map((i) => makeRun("t", T0 + i * 20 * MIN, 1000, SENS, { sensRole: "base" }));
    assert.equal(new Set(run("t", rs, T0 + DAY).runs.map((r) => r.sessionKey)).size, 1);
    assert.equal(new Set(run("t", rs, T0 + DAY, { gapMinutes: 10 } as never).runs.map((r) => r.sessionKey)).size, 6);
  });

  it("meta usa successProb: dificil < normal < facil", () => {
    const all = simulate("t", { sessions: 20, runsPerSession: 4, sigma: 0.05, seed: 4, muAt: () => BASE });
    const t = (d: "easy" | "normal" | "hard") =>
      run("t", all, T0 + 20 * DAY, { target: { ...DEFAULT_TARGET, successProb: successProbFor(d) } }).nextTarget!;
    assert.ok(t("hard") > t("normal") && t("normal") > t("easy"));
    assert.deepEqual([successProbFor("easy"), successProbFor("normal"), successProbFor("hard")], [0.75, 0.6, 0.45]);
  });

  it("tendencia: crescimento claro vira up, estavel vira flat", () => {
    const up = run("t", simulate("t", { sessions: 30, runsPerSession: 4, sigma: 0.02, seed: 3, muAt: (s) => BASE + 0.01 * s }), T0 + 31 * DAY);
    assert.equal(up.trend, "up");
    assert.ok(up.trendSlopePct! > 0);
    const flat = run("t", simulate("t", { sessions: 30, runsPerSession: 4, sigma: 0.02, seed: 3, muAt: () => BASE }), T0 + 31 * DAY);
    assert.equal(flat.trend, "flat");
  });

  it("PB e sempre o maximo bruto, inclusive de runs invalidas", () => {
    const rs = [5000, 1000, 1000, 1000].map((pb, i) => makeRun("t", T0 + i * 6 * MIN, pb, SENS, { sensRole: "base" }));
    assert.equal(run("t", rs, T0 + DAY).pb, 5000);
  });

  it("difficultyHint: acerto constante vira too_easy", () => {
    // meta muito baixa (successProb ~1) -> hit quase sempre
    const all = simulate("t", { sessions: 20, runsPerSession: 4, sigma: 0.05, seed: 8, muAt: () => BASE });
    const sum = run("t", all, T0 + 21 * DAY, { target: { ...DEFAULT_TARGET, successProb: 0.999 } });
    assert.equal(sum.difficultyHint, "too_easy");
  });
});
