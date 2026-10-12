import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recalculateAllTaskThresholds,
  estimateSessionThreshold,
  getTargetThresholdForTask,
  computeTaskMetrics,
  buildEscalateFormat,
} from "../src/lib/threshold.ts";
import type { Task, Session } from "../src/lib/types.ts";

function createMockTask(sessions: Partial<Session>[] = []): Task {
  return {
    id: "task-test",
    name: "1w2ts Pasu",
    category: "Click Timing",
    subcategory: "Dynamic",
    sessions: sessions.map((s, idx) => ({
      id: s.id ?? `sess-${idx}`,
      date: s.date ?? "2026-10-01",
      sens: s.sens ?? 45,
      pb: s.pb ?? 100,
      threshold: s.threshold ?? 0,
      sourceFile: s.sourceFile,
    })),
  };
}

describe("threshold characterization tests (current behavior)", () => {
  it("Day 1 with single run: threshold is round(PB * 0.92)", () => {
    const task = createMockTask([{ date: "2026-10-01", pb: 1000 }]);
    recalculateAllTaskThresholds(task);
    assert.equal(task.sessions[0].threshold, 920);
  });

  it("Day 1 with multiple runs: threshold is second best score", () => {
    const task = createMockTask([
      { date: "2026-10-01", pb: 850 },
      { date: "2026-10-01", pb: 900 },
      { date: "2026-10-01", pb: 880 },
    ]);
    recalculateAllTaskThresholds(task);
    // Scores are 900, 880, 850 -> second best is 880
    assert.equal(task.sessions[0].threshold, 880);
    assert.equal(task.sessions[1].threshold, 880);
    assert.equal(task.sessions[2].threshold, 880);
  });

  it("Subsequent days ratchet threshold upwards based on candidate", () => {
    const task = createMockTask([
      { date: "2026-10-01", pb: 900 }, // 1st day single run -> 828
      { date: "2026-10-02", pb: 1000 }, // 2nd day single run -> cand = round(1000 * 0.93) = 930 -> max(828, 930) = 930
      { date: "2026-10-03", pb: 1020 }, // 3rd day single run -> cand = round(1020 * 0.93) = 949 -> max(930, 949) = 949
    ]);
    recalculateAllTaskThresholds(task);
    assert.equal(task.sessions[0].threshold, 828);
    assert.equal(task.sessions[1].threshold, 930);
    assert.equal(task.sessions[2].threshold, 949);
  });

  it("Day with multiple runs uses max(candidate, secondPB)", () => {
    const task = createMockTask([
      { date: "2026-10-01", pb: 900 }, // D1 -> 828
      { date: "2026-10-02", pb: 1000 }, // D2 run 1
      { date: "2026-10-02", pb: 970 }, // D2 run 2 -> second best is 970, cand = max(930, 970) = 970 -> max(828, 970) = 970
    ]);
    recalculateAllTaskThresholds(task);
    assert.equal(task.sessions[0].threshold, 828);
    assert.equal(task.sessions[1].threshold, 970);
    assert.equal(task.sessions[2].threshold, 970);
  });

  it("Bad day under D1 rule: threshold never drops (ratchet-only hold)", () => {
    // Under D1 rule, threshold never regresses when dayPB < prevThreshold.
    // D1: [900, 880, 850] -> second PB is 880
    // D2: [950, 940] -> second PB is 940, candidate is max(round(950*0.93)=884, 940)=940 -> threshold 940
    // D3: [800] -> single run 800. cand = round(800*0.93)=744. candidate < 940. Threshold holds at 940.
    // D4: [900] -> cand = round(900*0.93)=837. max(940, 837) = 940.
    const task = createMockTask([
      { date: "2026-10-01", pb: 900 },
      { date: "2026-10-01", pb: 880 },
      { date: "2026-10-01", pb: 850 },
      { date: "2026-10-02", pb: 950 },
      { date: "2026-10-02", pb: 940 },
      { date: "2026-10-03", pb: 800 },
      { date: "2026-10-04", pb: 900 },
    ]);
    recalculateAllTaskThresholds(task);

    // Group 1: 2026-10-01
    assert.equal(task.sessions[0].threshold, 880);
    assert.equal(task.sessions[1].threshold, 880);
    assert.equal(task.sessions[2].threshold, 880);

    // Group 2: 2026-10-02
    assert.equal(task.sessions[3].threshold, 940);
    assert.equal(task.sessions[4].threshold, 940);

    // Group 3: 2026-10-03 (D1 HOLDS at 940)
    assert.equal(task.sessions[5].threshold, 940);

    // Group 4: 2026-10-04 (D1 HOLDS at 940)
    assert.equal(task.sessions[6].threshold, 940);
  });

  it("Correctly handles unsorted session dates by sorting chronologically", () => {
    const task = createMockTask([
      { date: "2026-10-03", pb: 1020 },
      { date: "2026-10-01", pb: 900 },
      { date: "2026-10-02", pb: 1000 },
    ]);
    recalculateAllTaskThresholds(task);
    assert.equal(task.sessions[0].date, "2026-10-01");
    assert.equal(task.sessions[0].threshold, 828);
    assert.equal(task.sessions[1].date, "2026-10-02");
    assert.equal(task.sessions[1].threshold, 930);
    assert.equal(task.sessions[2].date, "2026-10-03");
    assert.equal(task.sessions[2].threshold, 949);
  });

  it("getTargetThresholdForTask returns threshold of latest session", () => {
    assert.equal(getTargetThresholdForTask(null), null);
    assert.equal(getTargetThresholdForTask(createMockTask([])), null);

    const task = createMockTask([
      { date: "2026-10-01", pb: 1000, threshold: 920 },
      { date: "2026-10-02", pb: 1100, threshold: 1023 },
    ]);
    assert.equal(getTargetThresholdForTask(task), 1023);
  });

  it("estimateSessionThreshold covers all detailKey branches", () => {
    // 1. detailNoTask
    const noTask = estimateSessionThreshold(null, [1000]);
    assert.equal(noTask.detailKey, "session.detailNoTask");
    assert.equal(noTask.threshold, null);

    // 2. detailTypeScores: task has no sessions and input has no scores
    const taskEmpty = createMockTask([]);
    const typeScores = estimateSessionThreshold(taskEmpty, []);
    assert.equal(typeScores.detailKey, "session.detailTypeScores");
    assert.equal(typeScores.threshold, null);

    // 3. detailFirst: task has no sessions but input has scores
    const firstSingle = estimateSessionThreshold(taskEmpty, [1000]);
    assert.equal(firstSingle.detailKey, "session.detailFirst");
    assert.equal(firstSingle.threshold, 920); // round(1000 * 0.92)

    const firstMulti = estimateSessionThreshold(taskEmpty, [1000, 950, 900]);
    assert.equal(firstMulti.detailKey, "session.detailFirst");
    assert.equal(firstMulti.threshold, 950); // second best

    // Setup task with existing sessions (threshold = 950)
    const taskWithSessions = createMockTask([
      { date: "2026-10-01", pb: 1000, threshold: 950 },
    ]);

    // 4. detailGoal: existing threshold, but input scores empty
    const goalRes = estimateSessionThreshold(taskWithSessions, []);
    assert.equal(goalRes.detailKey, "session.detailGoal");
    assert.equal(goalRes.threshold, 950);

    // 5. detailEvolved: scores result in estimatedThreshold > targetThresh
    // targetThresh is 950. single run 1100 -> cand = round(1100 * 0.93) = 1023 > 950
    const evolvedRes = estimateSessionThreshold(taskWithSessions, [1100]);
    assert.equal(evolvedRes.detailKey, "session.detailEvolved");
    assert.equal(evolvedRes.threshold, 1023);

    // 6. detailMaintained: scores do not exceed targetThresh
    // targetThresh is 950. runs [960] -> cand = round(960 * 0.93) = 893 -> max(950, 893) = 950
    const maintainedRes = estimateSessionThreshold(taskWithSessions, [960]);
    assert.equal(maintainedRes.detailKey, "session.detailMaintained");
    assert.equal(maintainedRes.threshold, 950);
  });

  it("computeTaskMetrics calculates maxPB, targetThreshold, hitRate, and streak", () => {
    // Empty task
    assert.deepEqual(computeTaskMetrics(null), {
      maxPB: null,
      targetThreshold: null,
      hitRate: null,
      streak: 0,
      lastSens: null,
    });

    // 1-day task: no eligible days for hitRate (1st day hit is null), streak is 0
    const day1Task = createMockTask([
      { date: "2026-10-01", pb: 900, sens: 45, threshold: 828 },
    ]);
    const m1 = computeTaskMetrics(day1Task);
    assert.equal(m1.maxPB, 900);
    assert.equal(m1.targetThreshold, 828);
    assert.equal(m1.hitRate, null);
    assert.equal(m1.streak, 0);
    assert.equal(m1.lastSens, 45);

    // Multi-day task:
    // D1: thresh 828, best 900 (hit: null)
    // D2: thresh 930, best 1000 (targetBefore: 828 -> hit: true)
    // D3: thresh 930, best 800 (targetBefore: 930 -> hit: false)
    // D4: thresh 930, best 950 (targetBefore: 930 -> hit: true)
    // D5: thresh 950, best 1020 (targetBefore: 930 -> hit: true)
    // Total eligible days: 4 (D2, D3, D4, D5). Hits: 3 (D2, D4, D5).
    // hitRate = 3 / 4 * 100 = 75.0%
    // Streak from end: D5 (hit) -> D4 (hit) -> D3 (miss) => streak = 2
    const multiTask = createMockTask([
      { date: "2026-10-01", pb: 900, sens: 45, threshold: 828 },
      { date: "2026-10-02", pb: 1000, sens: 45, threshold: 930 },
      { date: "2026-10-03", pb: 800, sens: 45, threshold: 930 },
      { date: "2026-10-04", pb: 950, sens: 45, threshold: 930 },
      { date: "2026-10-05", pb: 1020, sens: 47, threshold: 950 },
    ]);
    const m2 = computeTaskMetrics(multiTask);
    assert.equal(m2.maxPB, 1020);
    assert.equal(m2.targetThreshold, 950);
    assert.equal(m2.hitRate, 75.0);
    assert.equal(m2.streak, 2);
    assert.equal(m2.lastSens, 47);
  });

  it("buildEscalateFormat preserves exact PB [T] (dd/mm) format", () => {
    const task = createMockTask([
      { date: "2026-10-01", pb: 900, sens: 45, threshold: 828 },
      { date: "2026-10-02", pb: 950, sens: 45, threshold: 884 },
    ]);
    const output = buildEscalateFormat(task);
    assert.equal(
      output,
      "1w2ts Pasu - 45cm 103\n900 [828] (01/10) 950 [884] (02/10)"
    );
  });
});
