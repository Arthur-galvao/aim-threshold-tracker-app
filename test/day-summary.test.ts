import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeDays, type DaySummary } from "../src/lib/day-summary.ts";
import type { Task, Session } from "../src/lib/types.ts";

function createMockTask(sessions: Partial<Session>[] = []): Task {
  return {
    id: "task-1",
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

describe("day-summary analytics", () => {
  it("returns empty array when task is null or has no sessions", () => {
    assert.deepEqual(summarizeDays(null), []);
    assert.deepEqual(summarizeDays(createMockTask([])), []);
  });

  it("summarizes single day with multiple runs correctly", () => {
    const task = createMockTask([
      { date: "2026-10-01", pb: 900, sens: 45, threshold: 880 },
      { date: "2026-10-01", pb: 850, sens: 45, threshold: 880 },
      { date: "2026-10-01", pb: 880, sens: 50, threshold: 880 },
    ]);

    const summaries = summarizeDays(task);
    assert.equal(summaries.length, 1);

    const d1 = summaries[0];
    assert.equal(d1.date, "2026-10-01");
    assert.equal(d1.runs, 3);
    assert.equal(d1.best, 900);
    assert.equal(d1.second, 880);
    assert.equal(d1.min, 850);
    assert.equal(d1.avg, 877); // (900 + 850 + 880) / 3 = 876.666 -> 877
    assert.equal(d1.threshold, 880);
    assert.equal(d1.targetBefore, null); // 1st day has no targetBefore
    assert.equal(d1.hit, null); // 1st day hit is null
    assert.deepEqual(d1.sens.sort(), [45, 50]);
    assert.equal(d1.isPbDay, true); // initial established PB
  });

  it("summarizes multi-day progression with targetBefore, hit/miss, and isPbDay", () => {
    // D1: best 900, threshold 880 (targetBefore: null, hit: null, isPbDay: true)
    // D2: best 950, threshold 940 (targetBefore: 880, hit: true because 950 >= 880, isPbDay: true)
    // D3: best 800, threshold 940 (targetBefore: 940, hit: false because 800 < 940, isPbDay: false)
    // D4: best 920, threshold 940 (targetBefore: 940, hit: false because 920 < 940, isPbDay: false)
    // D5: best 980, threshold 960 (targetBefore: 940, hit: true because 980 >= 940, isPbDay: true)
    const task = createMockTask([
      { date: "2026-10-01", pb: 900, threshold: 880 },
      { date: "2026-10-02", pb: 950, threshold: 940 },
      { date: "2026-10-03", pb: 800, threshold: 940 },
      { date: "2026-10-04", pb: 920, threshold: 940 },
      { date: "2026-10-05", pb: 980, threshold: 960 },
    ]);

    const summaries = summarizeDays(task);
    assert.equal(summaries.length, 5);

    // D1
    assert.equal(summaries[0].date, "2026-10-01");
    assert.equal(summaries[0].targetBefore, null);
    assert.equal(summaries[0].hit, null);
    assert.equal(summaries[0].isPbDay, true);

    // D2
    assert.equal(summaries[1].date, "2026-10-02");
    assert.equal(summaries[1].targetBefore, 880);
    assert.equal(summaries[1].hit, true);
    assert.equal(summaries[1].isPbDay, true);

    // D3
    assert.equal(summaries[2].date, "2026-10-03");
    assert.equal(summaries[2].targetBefore, 940);
    assert.equal(summaries[2].hit, false);
    assert.equal(summaries[2].isPbDay, false);

    // D4
    assert.equal(summaries[3].date, "2026-10-04");
    assert.equal(summaries[3].targetBefore, 940);
    assert.equal(summaries[3].hit, false);
    assert.equal(summaries[3].isPbDay, false);

    // D5
    assert.equal(summaries[4].date, "2026-10-05");
    assert.equal(summaries[4].targetBefore, 940);
    assert.equal(summaries[4].hit, true);
    assert.equal(summaries[4].isPbDay, true);
  });

  it("handles out of order session input by sorting dates ascending", () => {
    const task = createMockTask([
      { date: "2026-10-03", pb: 950, threshold: 920 },
      { date: "2026-10-01", pb: 900, threshold: 880 },
      { date: "2026-10-02", pb: 920, threshold: 900 },
    ]);

    const summaries = summarizeDays(task);
    assert.equal(summaries[0].date, "2026-10-01");
    assert.equal(summaries[1].date, "2026-10-02");
    assert.equal(summaries[2].date, "2026-10-03");
  });
});
