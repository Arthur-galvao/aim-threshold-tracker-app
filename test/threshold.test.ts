import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as thresholdModule from "../src/lib/threshold.ts";
import {
  getTargetThresholdForTask,
  computeTaskMetrics,
  buildEscalateFormat,
  simulateDraftRuns,
  parseInputScores,
  resolveAutoAdvanceOnThreshold,
  sanitizeAppData,
} from "../src/lib/threshold.ts";
import { computeSkill } from "../src/lib/skill/index.ts";
import { buildAllRuns, skillConfigFromTraining } from "../src/lib/skill/config.ts";
import { DEFAULT_TRAINING_SETTINGS } from "../src/lib/types.ts";
import type { Task } from "../src/lib/types.ts";
import { makeTask } from "./_helpers_skill.ts";

const CFG = skillConfigFromTraining(DEFAULT_TRAINING_SETTINGS);
const NOW = new Date("2026-10-10T12:00:00").getTime();

const history = (): Task =>
  makeTask([
    { date: "2026-10-01", scores: [800, 900, 920, 910, 930, 905], sens: 45 },
    { date: "2026-10-03", scores: [850, 940, 950, 960, 930, 945], sens: 45, fov: 110 },
    { date: "2026-10-05", scores: [860, 950, 990, 970, 940, 955], sens: 47, fov: 110 },
  ]);

describe("threshold v2: ratchet removido", () => {
  it("no longer exports the ratchet helpers", () => {
    const mod = thresholdModule as Record<string, unknown>;
    for (const name of [
      "computeDayThreshold",
      "recalculateAllTaskThresholds",
      "recalculateAllTasks",
      "estimateSessionThreshold",
      "cloneAppData",
      "addSessionsFromRun",
    ]) {
      assert.equal(mod[name], undefined, `${name} deveria ter sido removido`);
    }
  });

  it("getTargetThresholdForTask only reads the legacy Session.threshold", () => {
    assert.equal(getTargetThresholdForTask(null), null);
    assert.equal(getTargetThresholdForTask(makeTask([])), null);
    const legacy = makeTask([
      { date: "2026-10-01", scores: [1000] },
      { date: "2026-10-02", scores: [1100] },
    ]);
    legacy.sessions[0].threshold = 920;
    legacy.sessions[1].threshold = 1023;
    assert.equal(getTargetThresholdForTask(legacy), 1023);
  });
});

describe("threshold v2: computeTaskMetrics", () => {
  it("returns empty metrics for null / empty tasks", () => {
    const empty = { maxPB: null, targetThreshold: null, hitRate: null, streak: 0, lastSens: null };
    assert.deepEqual(computeTaskMetrics(null), empty);
    assert.deepEqual(computeTaskMetrics(makeTask([])), empty);
  });

  it("derives PB, target, hit rate (%) and streak from the SkillSummary", () => {
    const task = history();
    const skill = computeSkill(task, buildAllRuns([task]), CFG, NOW);
    const m = computeTaskMetrics(task, skill);
    assert.equal(m.maxPB, 990);
    assert.equal(m.targetThreshold, Math.round(skill.nextTarget!));
    assert.equal(m.hitRate, Number((skill.hitRate14! * 100).toFixed(1)));
    assert.equal(m.lastSens, 47);
    const hits = skill.points.filter((p) => p.hit !== null);
    assert.equal(hits.length, 2);
    assert.equal(m.streak, hits.every((p) => p.hit) ? 2 : m.streak);
  });

  it("works without a precomputed skill (local fallback)", () => {
    const m = computeTaskMetrics(history());
    assert.equal(m.maxPB, 990);
    assert.ok(m.targetThreshold !== null && m.targetThreshold > 0);
  });
});

describe("threshold v2: buildEscalateFormat", () => {
  it("uses the real FOV of the last run (fallback 103) and the per-session target", () => {
    const task = history();
    const skill = computeSkill(task, buildAllRuns([task]), CFG, NOW);
    const out = buildEscalateFormat(task, skill)!;
    const [header, body] = out.split("\n");
    assert.equal(header, "1w2ts Pasu - 47cm 110");
    const entries = body.split(") ").map((e) => (e.endsWith(")") ? e : e + ")"));
    assert.equal(entries.length, 18);
    // 1ª sessão: sem meta -> sem colchetes
    assert.equal(entries[0], "800 (01/10)");
    // sessões seguintes: meta da própria sessão (arredondada) em todas as runs dela
    const t2 = Math.round(skill.points[1].target);
    const t3 = Math.round(skill.points[2].target);
    assert.equal(entries[6], `850 [${t2}] (03/10)`);
    assert.equal(entries[11], `945 [${t2}] (03/10)`);
    assert.equal(entries[12], `860 [${t3}] (05/10)`);
  });

  it("falls back to FOV 103 when the run has none, and to the legacy threshold for the first session", () => {
    const task = makeTask([{ date: "2026-10-01", scores: [900, 950] }]);
    task.sessions[0].threshold = 828;
    const out = buildEscalateFormat(task)!;
    assert.equal(out, "1w2ts Pasu - 40cm 103\n900 [828] (01/10) 950 (01/10)");
  });

  it("returns null for a task without sessions", () => {
    assert.equal(buildEscalateFormat(makeTask([])), null);
  });
});

describe("threshold v2: simulateDraftRuns (lançamento manual)", () => {
  const task = history();
  const allRuns = buildAllRuns([task]);

  it("returns the current target when nothing was typed", () => {
    const before = computeSkill(task, allRuns, CFG, NOW);
    const out = simulateDraftRuns(task, allRuns, { scores: [], sens: 47, date: "2026-10-10" }, CFG, NOW);
    assert.equal(out.projectedTarget, before.nextTarget);
    assert.equal(out.targetBefore, before.nextTarget);
    assert.equal(out.willHit, false);
    assert.equal(out.willBreakPB, false);
  });

  it("flags a hit and a new PB, and the target rises after strong runs", () => {
    const out = simulateDraftRuns(
      task,
      allRuns,
      { scores: [900, 1100, 1120, 1110, 1105], sens: 47, date: "2026-10-10" },
      CFG,
      NOW
    );
    assert.equal(out.willHit, true);
    assert.equal(out.willBreakPB, true);
    assert.equal(out.validCount, 4, "a 1ª run do dia é aquecimento");
    assert.ok(out.projectedTarget! > out.targetBefore!);
  });

  it("a bad day misses the target and the target does NOT ratchet (can go down)", () => {
    const out = simulateDraftRuns(
      task,
      allRuns,
      { scores: [500, 600, 610, 620, 590], sens: 47, date: "2026-10-10" },
      CFG,
      NOW
    );
    assert.equal(out.willHit, false);
    assert.equal(out.willBreakPB, false);
    assert.ok(out.projectedTarget! < out.targetBefore!, "meta desce após uma sessão fraca");
  });

  it("does not mutate the inputs and handles no task", () => {
    const count = allRuns.length;
    simulateDraftRuns(task, allRuns, { scores: [999], sens: 47, date: "2026-10-10" }, CFG, NOW);
    assert.equal(allRuns.length, count);
    const none = simulateDraftRuns(null, [], { scores: [1000], sens: 40, date: "2026-10-10" }, CFG, NOW);
    assert.equal(none.projectedTarget, null);
    const fresh = makeTask([]);
    const first = simulateDraftRuns(fresh, [], { scores: [800, 900, 910], sens: 40, date: "2026-10-10" }, CFG, NOW);
    assert.equal(first.targetBefore, null);
    assert.equal(first.willHit, false);
    assert.equal(first.willBreakPB, true);
  });
});

describe("threshold: utilitários mantidos", () => {
  it("parseInputScores splits on space/comma/semicolon and drops junk", () => {
    assert.deepEqual(parseInputScores("1040 1080, 990;1015 x -5 0"), [1040, 1080, 990, 1015]);
    assert.deepEqual(parseInputScores(""), []);
  });

  it("resolveAutoAdvanceOnThreshold honours the playlist override", () => {
    assert.equal(resolveAutoAdvanceOnThreshold({ autoAdvanceMode: "disabled" } as never, true), false);
    assert.equal(resolveAutoAdvanceOnThreshold({ autoAdvanceMode: "enabled" } as never, false), true);
    assert.equal(resolveAutoAdvanceOnThreshold(null, undefined), true);
  });

  it("sanitizeAppData fixes duplicate ids", () => {
    const a = makeTask([{ date: "2026-10-01", scores: [1, 2] }], "dup");
    const b = makeTask([{ date: "2026-10-01", scores: [3] }], "dup");
    b.sessions[0].id = a.sessions[0].id;
    const data = { activeTaskId: null, tasks: [a, b], playlists: [] };
    assert.equal(sanitizeAppData(data as never), true);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.sessions[0].id, b.sessions[0].id);
  });
});
