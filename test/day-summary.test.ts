import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeTrainingSessions,
  buildChartSeries,
  filterChartSeries,
} from "../src/lib/day-summary.ts";
import { computeSkill } from "../src/lib/skill/index.ts";
import { buildAllRuns, skillConfigFromTraining } from "../src/lib/skill/config.ts";
import { DEFAULT_TRAINING_SETTINGS } from "../src/lib/types.ts";
import type { Task } from "../src/lib/types.ts";
import { makeTask } from "./_helpers_skill.ts";

const NOW = new Date("2026-10-10T12:00:00").getTime();

function skillOf(task: Task) {
  return computeSkill(task, buildAllRuns([task]), skillConfigFromTraining(DEFAULT_TRAINING_SETTINGS), NOW);
}

// 1ª run (10:00) e 2ª (10:03) caem no aquecimento padrão (1 run + 5 min).
const task = makeTask([
  { date: "2026-10-01", scores: [800, 900, 920, 910, 930, 905] },
  { date: "2026-10-03", scores: [850, 940, 950, 960, 930, 945] },
  { date: "2026-10-05", scores: [860, 950, 990, 970, 940, 955] },
  { date: "2026-10-07", scores: [700, 800, 810, 820, 790, 805] },
]);

describe("day-summary: sessões de treino (Threshold v2)", () => {
  it("returns empty for null task / no skill", () => {
    assert.deepEqual(summarizeTrainingSessions(null, null), []);
    assert.deepEqual(summarizeTrainingSessions(task, null), []);
    assert.deepEqual(buildChartSeries(null, null).runs, []);
  });

  it("groups by training session with valid counts, target and hit", () => {
    const list = summarizeTrainingSessions(task, skillOf(task));
    assert.equal(list.length, 4);
    for (const s of list) {
      assert.equal(s.runs, 6);
      assert.equal(s.validRuns, 4, "aquecimento (2 runs) não conta");
    }
    // melhor bruto inclui runs de aquecimento; melhor ajustado só as válidas
    assert.equal(list[1].best, 960);
    assert.ok(Math.abs((list[1].bestAdjusted ?? 0) - 960) < 1e-6);
    assert.ok((list[0].bestAdjusted ?? 0) <= list[0].best);
  });

  it("first session has no target/hit; later sessions have a target and hit flag", () => {
    const list = summarizeTrainingSessions(task, skillOf(task));
    assert.equal(list[0].target, null);
    assert.equal(list[0].hit, null);
    assert.ok(list[1].target !== null && list[1].target > 0);
    assert.equal(typeof list[1].hit, "boolean");
    // o dia ruim (700-820) fica abaixo da meta e é um MISS
    assert.equal(list[3].hit, false);
    assert.equal(list[3].isPb, false);
    assert.deepEqual(list.slice(0, 3).map((s) => s.isPb), [true, true, true]);
  });

  it("splits one calendar day into two sessions when the gap is > 45 min", () => {
    const morning = makeTask([{ date: "2026-10-01", scores: [900, 910, 920] }]);
    const evening = makeTask([{ date: "2026-10-01", scores: [905, 915, 925] }]);
    evening.sessions.forEach((s, i) => {
      s.id = `late_${i}`;
      s.datetime = `2026-10-01T18:${String(i * 3).padStart(2, "0")}:00`;
    });
    const both: Task = { ...morning, sessions: [...morning.sessions, ...evening.sessions] };
    const list = summarizeTrainingSessions(both, skillOf(both));
    assert.equal(list.length, 2);
    assert.equal(list[0].date, "2026-10-01");
    assert.equal(list[1].date, "2026-10-01");
    assert.ok(list[1].startedAt > list[0].endedAt);
  });

  it("buildChartSeries exposes runs (valid/invalid + reason), session steps and running PB", () => {
    const series = buildChartSeries(task, skillOf(task));
    assert.equal(series.runs.length, 24);
    assert.equal(series.sessions.length, 4);
    assert.equal(series.runs[0].valid, false);
    assert.equal(series.runs[0].reason, "warmup");
    assert.equal(series.runs[2].valid, true);
    assert.equal(series.sessions[0].target, null);
    assert.ok(series.sessions[1].target !== null);
    assert.ok(series.sessions[1].lo < series.sessions[1].mu && series.sessions[1].mu < series.sessions[1].hi);
    assert.equal(series.sessions[0].startIdx, 0);
    assert.equal(series.sessions[0].endIdx, 5);
    assert.equal(series.pbRunning[series.pbRunning.length - 1], 990);
    for (let i = 1; i < series.pbRunning.length; i++) assert.ok(series.pbRunning[i] >= series.pbRunning[i - 1]);
  });

  it("filterChartSeries reindexes runs and drops empty sessions", () => {
    const series = buildChartSeries(task, skillOf(task));
    const last = filterChartSeries(series, (r) => r.sessionIdx >= 2);
    assert.equal(last.runs.length, 12);
    assert.equal(last.sessions.length, 2);
    assert.equal(last.runs[0].index, 0);
    assert.equal(last.sessions[0].startIdx, 0);
    assert.equal(last.sessions[1].startIdx, 6);
    assert.equal(last.runs[0].sessionIdx, 0);
    assert.equal(last.pbRunning.length, 12);
  });
});
