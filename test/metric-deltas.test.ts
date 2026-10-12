import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMetricDeltas,
  computeTargetProgress,
  extractRecentTrend,
} from "../src/lib/metric-deltas.ts";
import type { Task, Session } from "../src/lib/types.ts";

describe("metric-deltas analytics", () => {
  const mockSessions: Session[] = [
    {
      id: "s1",
      date: "2026-10-01",
      pb: 940,
      sens: 45,
      threshold: 900,
    },
    {
      id: "s2",
      date: "2026-10-02",
      pb: 970,
      sens: 45,
      threshold: 920,
    },
    {
      id: "s3",
      date: "2026-10-03",
      pb: 1020,
      sens: 45,
      threshold: 960,
    },
  ];

  const mockTask: Task = {
    id: "task-1",
    name: "1w2ts Pasu Perfected",
    category: "Flick Tech",
    subcategory: "Speed",
    sessions: mockSessions,
  };

  it("calculates deltas correctly against previous session", () => {
    const deltas = computeMetricDeltas(mockTask);
    assert.ok(deltas);
    // last pb is 1020, previous pb is 970 -> +50
    assert.equal(deltas.scoreDelta, 50);
    // last threshold is 960, previous is 920 -> +40
    assert.equal(deltas.thresholdDelta, 40);
  });

  it("handles null task or task with fewer than 2 sessions safely", () => {
    assert.deepEqual(computeMetricDeltas(null), {
      scoreDelta: null,
      thresholdDelta: null,
    });

    const singleSessionTask: Task = {
      ...mockTask,
      sessions: [mockSessions[0]],
    };
    assert.deepEqual(computeMetricDeltas(singleSessionTask), {
      scoreDelta: null,
      thresholdDelta: null,
    });
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
    assert.equal(deficit.percentage, 95);
  });

  it("extracts recent trend normalized data points for sparkline", () => {
    const trend = extractRecentTrend(mockTask, 5);
    assert.equal(trend.length, 3);
    assert.equal(trend[0], 940);
    assert.equal(trend[1], 970);
    assert.equal(trend[2], 1020);
  });

  it("returns empty array for sparkline when task has no sessions", () => {
    assert.deepEqual(extractRecentTrend(null, 5), []);
    assert.deepEqual(
      extractRecentTrend({ ...mockTask, sessions: [] }, 5),
      []
    );
  });

  it("calculates deltas across distinct days even when a day has multiple runs", () => {
    const multiRunTask: Task = {
      id: "task-multi",
      name: "1w2ts Pasu Multi",
      category: "Flick Tech",
      subcategory: "Speed",
      sessions: [
        // Day 1: runs 900, 940 (best: 940, thresh: 900)
        { id: "s1", date: "2026-10-01", pb: 900, sens: 45, threshold: 900 },
        { id: "s2", date: "2026-10-01", pb: 940, sens: 45, threshold: 900 },
        // Day 2: runs 960, 1000 (best: 1000, thresh: 940)
        { id: "s3", date: "2026-10-02", pb: 960, sens: 45, threshold: 940 },
        { id: "s4", date: "2026-10-02", pb: 1000, sens: 45, threshold: 940 },
      ],
    };

    const deltas = computeMetricDeltas(multiRunTask);
    // Compares Day 2 best (1000) vs Day 1 best (940) -> +60
    assert.equal(deltas.scoreDelta, 60);
    // Compares Day 2 threshold (940) vs Day 1 threshold (900) -> +40
    assert.equal(deltas.thresholdDelta, 40);

    const trend = extractRecentTrend(multiRunTask, 5);
    // Trend should have 2 points (one best per day: 940, 1000)
    assert.deepEqual(trend, [940, 1000]);
  });
});
