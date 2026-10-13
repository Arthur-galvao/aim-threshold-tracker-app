import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRunPoints, movingMedian, runTimestamp, type RunPoint } from "../src/lib/run-points.ts";
import type { Task } from "../src/lib/types.ts";

function createMockTask(
  name: string,
  sessions: Array<{
    id?: string;
    date: string;
    pb: number;
    sens: number;
    sourceFile?: string;
  }>
): Task {
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
      sourceFile: s.sourceFile,
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

  it("movingMedian computes sliding window median over bounded ranges", () => {
    assert.deepEqual(movingMedian([], 2), []);
    const vals = [10, 20, 30, 40, 50];
    const medians = movingMedian(vals, 1);
    // i=0: [10, 20] -> 15
    // i=1: [10, 20, 30] -> 20
    // i=2: [20, 30, 40] -> 30
    // i=3: [30, 40, 50] -> 40
    // i=4: [40, 50] -> 45
    assert.deepEqual(medians, [15, 20, 30, 40, 45]);
  });

  it("increasing score trend with balanced sens produces rel without trend (regression slope near zero)", () => {
    // 45 runs across 3 balanced sensitivities (40, 50, 68) with steady +3 pts per run upward trend
    const N = 45;
    const sensCycle = [40, 50, 68];
    const sessions = Array.from({ length: N }, (_, i) => {
      const mm = String(Math.floor(i / 60)).padStart(2, "0");
      const ss = String(i % 60).padStart(2, "0");
      return {
        date: "2026-10-01",
        pb: 1000 + 3 * i,
        sens: sensCycle[i % 3],
        sourceFile: `WALLHACK - 2026.10.01-10.${mm}.${ss} Stats.csv`,
      };
    });

    const task = createMockTask("balanced-trend", sessions);
    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, N);
    assert.equal(points[0].relReliable, true);

    const meanI = (N - 1) / 2;
    const meanRel = points.reduce((acc, p) => acc + p.rel, 0) / N;
    let cov = 0;
    let varI = 0;
    for (let i = 0; i < N; i++) {
      cov += (i - meanI) * (points[i].rel - meanRel);
      varI += (i - meanI) * (i - meanI);
    }
    const slope = cov / varI;

    // Detrended rel should have linear regression slope close to zero (|slope| < 0.05)
    assert(
      Math.abs(slope) < 0.05,
      `Expected slope near zero, got ${slope}`
    );
  });

  it("synthetic fixed-sens blocks recovers at least 80% of true contrast", () => {
    // Sequence 50 x30, 68 x15, 50 x15, 68 x15 (total 75 runs)
    // 68 yields +4% true vs baseline 1000 (+40 pts) and +0.2% trend per run (+2 pts per run)
    const sensArr = [
      ...Array(30).fill(50),
      ...Array(15).fill(68),
      ...Array(15).fill(50),
      ...Array(15).fill(68),
    ];
    const task = createMockTask(
      "fixed-blocks",
      sensArr.map((sens, idx) => {
        const mm = String(Math.floor(idx / 60)).padStart(2, "0");
        const ss = String(idx % 60).padStart(2, "0");
        return {
          date: "2026-10-01",
          pb: 1000 + 2 * idx + (sens === 68 ? 40 : 0),
          sens,
          sourceFile: `WALLHACK - 2026.10.01-10.${mm}.${ss} Stats.csv`,
        };
      })
    );

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 75);

    const rel50 = points.filter((p) => p.sens === 50).map((p) => p.rel);
    const rel68 = points.filter((p) => p.sens === 68).map((p) => p.rel);
    const mean50 = rel50.reduce((a, b) => a + b, 0) / rel50.length;
    const mean68 = rel68.reduce((a, b) => a + b, 0) / rel68.length;
    const contrast = mean68 - mean50;

    // True contrast is 4.0 points (+4%); at least 80% is 3.2 points
    assert(
      contrast >= 3.2,
      `Expected contrast to be >= 3.2 (80% of true 4.0), got ${contrast}`
    );
  });

  it("scenario with 11 eligible runs generates relReliable = false", () => {
    const sessions = Array.from({ length: 11 }, (_, i) => {
      const mm = String(Math.floor(i / 60)).padStart(2, "0");
      const ss = String(i % 60).padStart(2, "0");
      return {
        date: "2026-10-01",
        pb: 100 + i,
        sens: 40 + (i % 3) * 10,
        sourceFile: `WALLHACK - 2026.10.01-10.${mm}.${ss} Stats.csv`,
      };
    });

    const task = createMockTask("eleven-runs", sessions);
    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 11);
    for (const pt of points) {
      assert.equal(pt.relReliable, false);
    }
  });

  it("scenario with 2 distinct grid points generates relReliable = false even with >= 12 runs", () => {
    // 20 runs alternating between only 2 grid points (50 and 68 cm)
    const sessions = Array.from({ length: 20 }, (_, i) => {
      const mm = String(Math.floor(i / 60)).padStart(2, "0");
      const ss = String(i % 60).padStart(2, "0");
      return {
        date: "2026-10-01",
        pb: 100 + i,
        sens: i % 2 === 0 ? 50 : 68,
        sourceFile: `WALLHACK - 2026.10.01-10.${mm}.${ss} Stats.csv`,
      };
    });

    const task = createMockTask("two-grid-points", sessions);
    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 20);
    for (const pt of points) {
      assert.equal(pt.relReliable, false);
    }
  });

  it("produces comparable relative performance across vastly different score scales", () => {
    // Task A has score ~1000, Task B has score ~40 (+10% produces rel ~110)
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

  it("sorts runs on the same day chronologically by sourceFile timestamp", () => {
    const task = createMockTask("same-day", [
      { id: "s3", date: "2026-10-12", pb: 100, sens: 45, sourceFile: "WALLHACK - Challenge - 2026.10.12-18.30.00 Stats.csv" },
      { id: "s1", date: "2026-10-12", pb: 90, sens: 45, sourceFile: "WALLHACK - Challenge - 2026.10.12-09.15.00 Stats.csv" },
      { id: "s2", date: "2026-10-12", pb: 95, sens: 45, sourceFile: "WALLHACK - Challenge - 2026.10.12-14.00.00 Stats.csv" },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 3);
    assert.equal(points[0].sessionId, "s1");
    assert.equal(points[0].ts, "20261012091500");
    assert.equal(points[1].sessionId, "s2");
    assert.equal(points[1].ts, "20261012140000");
    assert.equal(points[2].sessionId, "s3");
    assert.equal(points[2].ts, "20261012183000");
  });

  it("falls back to date + 000000 when sourceFile is absent or does not match regex", () => {
    assert.equal(runTimestamp({ date: "2026-10-12" }), "20261012000000");
    assert.equal(runTimestamp({ date: "2026-10-12", sourceFile: "custom-file-without-date.csv" }), "20261012000000");

    const task = createMockTask("no-source", [
      { id: "s1", date: "2026-10-12", pb: 100, sens: 45 },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 1);
    assert.equal(points[0].ts, "20261012000000");
  });

  it("preserves stable order when two runs have identical timestamps", () => {
    const task = createMockTask("same-ts", [
      { id: "first", date: "2026-10-12", pb: 90, sens: 45, sourceFile: "WALLHACK - Challenge - 2026.10.12-10.00.00 Stats.csv" },
      { id: "second", date: "2026-10-12", pb: 95, sens: 45, sourceFile: "WALLHACK - Challenge - 2026.10.12-10.00.00 Stats.csv" },
    ]);

    const points = buildRunPoints([task], { dpi: 800 });
    assert.equal(points.length, 2);
    assert.equal(points[0].sessionId, "first");
    assert.equal(points[1].sessionId, "second");
    assert.equal(points[0].ts, points[1].ts);
  });
});
