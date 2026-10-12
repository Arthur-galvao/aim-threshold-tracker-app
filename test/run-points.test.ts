import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRunPoints, type RunPoint } from "../src/lib/run-points.ts";
import type { Task } from "../src/lib/types.ts";

function createMockTask(name: string, sessions: Array<{ id?: string; date: string; pb: number; sens: number }>): Task {
  return {
    id: `task-${name}`,
    name,
    category: "Click Timing",
    subcategory: "Dynamic",
    sessions: sessions.map((s, idx) => ({
      id: s.id ?? `sess-${idx}`,
      date: s.date,
      sens: s.sens,
      pb: s.pb,
      threshold: 0,
    })),
  };
}

describe("run-points constructor and baseline", () => {
  it("sorts points by date chronologically", () => {
    const task = createMockTask("1w2ts", [
      { id: "s3", date: "2026-10-03", pb: 100, sens: 45 },
      { id: "s1", date: "2026-10-01", pb: 90, sens: 45 },
      { id: "s2", date: "2026-10-02", pb: 95, sens: 45 },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 3);
    assert.equal(points[0].sessionId, "s1");
    assert.equal(points[1].sessionId, "s2");
    assert.equal(points[2].sessionId, "s3");
  });

  it("baseline excludes the current run score", () => {
    // If run 2 is an extreme outlier (500) amidst 100s, its baseline should remain 100, not skewed by 500
    const task = createMockTask("pasu", [
      { date: "2026-10-01", pb: 100, sens: 40 },
      { date: "2026-10-02", pb: 100, sens: 40 },
      { date: "2026-10-03", pb: 500, sens: 40 },
      { date: "2026-10-04", pb: 100, sens: 40 },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    const outlier = points.find((p) => p.score === 500);
    assert(outlier);
    // Baseline from other 3 runs is median(100, 100, 100) = 100 -> rel is 500 / 100 * 100 = 500
    assert.equal(outlier.rel, 500);
    assert.equal(outlier.relReliable, true);
  });

  it("marks relReliable as false when scenario has fewer than 3 other runs", () => {
    const task = createMockTask("short", [
      { date: "2026-10-01", pb: 100, sens: 45 },
      { date: "2026-10-02", pb: 110, sens: 45 },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 2);
    assert.equal(points[0].relReliable, false);
    assert.equal(points[0].rel, 100);
    assert.equal(points[1].relReliable, false);
    assert.equal(points[1].rel, 100);
  });

  it("produces comparable relative performance across vastly different score scales", () => {
    // Task A has score ~1000, Task B has score ~40
    const taskA = createMockTask("high-score", [
      { date: "2026-10-01", pb: 1000, sens: 40 },
      { date: "2026-10-02", pb: 1000, sens: 40 },
      { date: "2026-10-03", pb: 1000, sens: 40 },
      { date: "2026-10-04", pb: 1100, sens: 40 }, // +10%
    ]);
    const taskB = createMockTask("low-score", [
      { date: "2026-10-01", pb: 40, sens: 40 },
      { date: "2026-10-02", pb: 40, sens: 40 },
      { date: "2026-10-03", pb: 40, sens: 40 },
      { date: "2026-10-04", pb: 44, sens: 40 }, // +10%
    ]);

    const points = buildRunPoints([taskA, taskB], { dpi: 800 });
    const runA4 = points.find((p) => p.scenario === "high-score" && p.score === 1100);
    const runB4 = points.find((p) => p.scenario === "low-score" && p.score === 44);

    assert(runA4 && runB4);
    assert.equal(runA4.rel, 110);
    assert.equal(runB4.rel, 110);
  });

  it("detrends warming-up score drift with moving median window", () => {
    // Scores steadily increase 80, 85, 90, 95, 100, 105, 110, 115, 120
    const sessions = [80, 85, 90, 95, 100, 105, 110, 115, 120].map((score, i) => ({
      date: `2026-10-0${i + 1}`,
      pb: score,
      sens: 40,
    }));
    const task = createMockTask("warmup", sessions);

    const points = buildRunPoints([task], { dpi: 800, window: 3 });
    // Mid runs should have rel close to 100 despite steady upward drift
    const midPoint = points[4]; // 100
    // Neighbors in window 3: [85, 90, 95, 105, 110, 115], median is (95 + 105)/2 = 100
    assert.equal(midPoint.rel, 100);
  });
});
