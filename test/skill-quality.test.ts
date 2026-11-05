import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "../src/lib/types.ts";
import { runTime, type RunRef } from "../src/lib/skill/sessions.ts";
import {
  possibleAutopilot,
  scenarioQuality,
  type SessionQualityPoint,
} from "../src/lib/skill/quality.ts";

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

/** Uma sessão (grupo) com uma run por entrada de `runs` para o cenário `taskId`. */
function session(
  k: number,
  taskId: string,
  runs: Array<Partial<Session> & { pb: number }>,
): RunRef[] {
  return runs.map((r, i) => {
    const s: Session = { id: `s${k}-${i}`, date: "2026-01-01", sens: 1, threshold: 0, ...r };
    return { taskId, session: s, t: START + k * DAY + i * 60_000 };
  });
}

function pt(score: number, accuracy: number | null, ttk: number | null = null): SessionQualityPoint {
  return { sessionKey: "k", score, accuracy, ttk };
}

describe("scenarioQuality: tendências por sessão", () => {
  it("accuracy em queda → slope negativo; TTK em alta → slope positivo", () => {
    const groups = [0.9, 0.85, 0.8, 0.75, 0.7].map((acc, k) =>
      session(k, "t1", [{ pb: 100, accuracy: acc, avgTtk: 300 + k * 10 }]),
    );
    const q = scenarioQuality("t1", groups);
    assert.equal(q.series.length, 5);
    assert.ok(q.accuracySlope! < 0);
    assert.ok(q.ttkSlope! > 0);
    assert.ok(Math.abs(q.accuracySlope! + 0.05) < 1e-9);
  });

  it("média por sessão quando há várias runs do cenário na mesma sessão", () => {
    const groups = [
      session(0, "t1", [
        { pb: 100, accuracy: 0.8 },
        { pb: 200, accuracy: 0.6 },
      ]),
    ];
    const q = scenarioQuality("t1", groups);
    assert.equal(q.series[0].score, 150);
    assert.ok(Math.abs(q.series[0].accuracy! - 0.7) < 1e-12);
    assert.equal(q.series[0].ttk, null);
  });

  it("ignora sessões sem runs do cenário e outros cenários", () => {
    const groups = [
      session(0, "t2", [{ pb: 999, accuracy: 0.1 }]),
      session(1, "t1", [{ pb: 100, accuracy: 0.5 }]),
    ];
    const q = scenarioQuality("t1", groups);
    assert.equal(q.series.length, 1);
    assert.equal(q.series[0].score, 100);
  });

  it("accuracy/TTK ausentes em todas as sessões → slope null", () => {
    const groups = [0, 1, 2, 3].map((k) => session(k, "t1", [{ pb: 100 + k }]));
    const q = scenarioQuality("t1", groups);
    assert.equal(q.accuracySlope, null);
    assert.equal(q.ttkSlope, null);
  });

  it("menos de 3 valores de accuracy → slope null", () => {
    const groups = [0, 1].map((k) => session(k, "t1", [{ pb: 100, accuracy: 0.5 }]));
    assert.equal(scenarioQuality("t1", groups).accuracySlope, null);
  });

  it("sessões sem runs não quebram (lista vazia)", () => {
    const q = scenarioQuality("t1", []);
    assert.deepEqual(q.series, []);
    assert.equal(q.possibleAutopilot, false);
  });

  it("usa runTime sem datetime (legado) apenas para ordenar; sem exceções", () => {
    const s: Session = { id: "a", date: "2026-01-01", sens: 1, pb: 1, threshold: 0, accuracy: 0.5 };
    assert.ok(Number.isFinite(runTime(s)));
    const q = scenarioQuality("t1", [[{ taskId: "t1", session: s, t: runTime(s) }]]);
    assert.equal(q.series.length, 1);
  });
});

describe("possibleAutopilot", () => {
  it("score ↑ e accuracy caiu > 3 p.p. nas 2 últimas vs 2 anteriores → true", () => {
    const series = [pt(100, 0.8), pt(100, 0.8), pt(110, 0.74), pt(120, 0.7)];
    assert.equal(possibleAutopilot(series), true);
  });

  it("queda de exatamente 3 p.p. não dispara (estritamente maior)", () => {
    const series = [pt(100, 0.8), pt(100, 0.8), pt(110, 0.77), pt(120, 0.77)];
    assert.equal(possibleAutopilot(series), false);
  });

  it("queda de 4 p.p. dispara", () => {
    const series = [pt(100, 0.8), pt(100, 0.8), pt(110, 0.76), pt(120, 0.76)];
    assert.equal(possibleAutopilot(series), true);
  });

  it("score não subiu → false", () => {
    const series = [pt(120, 0.8), pt(120, 0.8), pt(110, 0.6), pt(100, 0.6)];
    assert.equal(possibleAutopilot(series), false);
  });

  it("accuracy não caiu → false", () => {
    const series = [pt(100, 0.8), pt(100, 0.8), pt(110, 0.8), pt(120, 0.82)];
    assert.equal(possibleAutopilot(series), false);
  });

  it("menos de 4 sessões → false", () => {
    assert.equal(possibleAutopilot([pt(100, 0.8), pt(110, 0.6), pt(120, 0.6)]), false);
  });

  it("accuracy ausente em alguma das 4 últimas → false", () => {
    const series = [pt(100, 0.8), pt(100, null), pt(110, 0.6), pt(120, 0.6)];
    assert.equal(possibleAutopilot(series), false);
  });

  it("só as 4 últimas sessões importam", () => {
    const series = [pt(50, 0.9), pt(200, 0.1), pt(100, 0.8), pt(100, 0.8), pt(110, 0.7), pt(120, 0.7)];
    assert.equal(possibleAutopilot(series), true);
  });

  it("scenarioQuality propaga o flag", () => {
    const accs = [0.8, 0.8, 0.7, 0.7];
    const pbs = [100, 100, 110, 120];
    const groups = accs.map((a, k) => session(k, "t1", [{ pb: pbs[k], accuracy: a }]));
    assert.equal(scenarioQuality("t1", groups).possibleAutopilot, true);
  });
});
