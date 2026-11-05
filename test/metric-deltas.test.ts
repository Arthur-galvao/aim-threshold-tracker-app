import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMetricDeltas,
  computeTargetProgress,
  extractRecentTrend,
  computedMetricsFromSkill,
  roundScore,
} from "../src/lib/metric-deltas.ts";
import { summarizeTrainingSessions } from "../src/lib/day-summary.ts";
import { computeSkill } from "../src/lib/skill/index.ts";
import { buildAllRuns, skillConfigFromTraining } from "../src/lib/skill/config.ts";
import { DEFAULT_TRAINING_SETTINGS } from "../src/lib/types.ts";
import { makeTask } from "./_helpers_skill.ts";

const NOW = new Date("2026-10-10T12:00:00").getTime();
const task = makeTask([
  { date: "2026-10-01", scores: [800, 900, 920, 910, 930, 905] },
  { date: "2026-10-03", scores: [850, 940, 950, 960, 930, 945] },
  { date: "2026-10-05", scores: [860, 950, 990, 970, 940, 955] },
]);
const skill = computeSkill(task, buildAllRuns([task]), skillConfigFromTraining(DEFAULT_TRAINING_SETTINGS), NOW);
const sessions = summarizeTrainingSessions(task, skill);

describe("metric-deltas (sobre sessões de treino)", () => {
  it("deltas compare the last training session with the previous one", () => {
    const d = computeMetricDeltas(sessions);
    assert.equal(d.scoreDelta, 990 - 960);
    assert.ok(d.targetDelta !== null, "ambas as sessões têm meta");
    assert.equal(d.targetDelta, Math.round(sessions[2].target! - sessions[1].target!));
  });

  it("target delta can be negative (the target is allowed to fall)", () => {
    const fake = [
      { ...sessions[1], target: 950 },
      { ...sessions[2], target: 930 },
    ];
    assert.equal(computeMetricDeltas(fake).targetDelta, -20);
  });

  it("is null with fewer than 2 sessions or when the first target is missing", () => {
    assert.deepEqual(computeMetricDeltas([]), { scoreDelta: null, targetDelta: null });
    assert.deepEqual(computeMetricDeltas([sessions[0]]), { scoreDelta: null, targetDelta: null });
    assert.equal(computeMetricDeltas(sessions.slice(0, 2)).targetDelta, null, "1ª sessão não tem meta");
  });

  it("computes target progress percentage and point difference", () => {
    const progress = computeTargetProgress(1020, 1000);
    assert.ok(progress);
    assert.equal(progress.achieved, true);
    assert.equal(progress.diff, 20);
    assert.equal(progress.percentage, 102);
    const deficit = computeTargetProgress(950, 1000);
    assert.ok(deficit);
    assert.equal(deficit.achieved, false);
    assert.equal(deficit.diff, -50);
    assert.equal(computeTargetProgress(null, 1000), null);
    assert.equal(computeTargetProgress(100, 0), null);
  });

  it("extracts the best score of each recent training session", () => {
    assert.deepEqual(extractRecentTrend(sessions, 5), [930, 960, 990]);
    assert.deepEqual(extractRecentTrend(sessions, 2), [960, 990]);
    assert.deepEqual(extractRecentTrend([], 5), []);
  });

  it("computedMetricsFromSkill mirrors the SkillSummary", () => {
    const m = computedMetricsFromSkill(skill);
    assert.equal(m.nextTarget, skill.nextTarget);
    assert.equal(m.personalBest, 990);
    assert.equal(m.trend, "insufficient");
    assert.ok(m.consistencyRatio !== null && m.consistencyRatio > 80 && m.consistencyRatio < 100);
    const empty = computedMetricsFromSkill(null);
    assert.equal(empty.nextTarget, null);
    assert.equal(empty.skill, null);
    assert.equal(empty.trend, "insufficient");
  });

  it("roundScore keeps one decimal below 100 and integers above", () => {
    assert.equal(roundScore(954.6), 955);
    assert.equal(roundScore(12.34), 12.3);
  });
});
