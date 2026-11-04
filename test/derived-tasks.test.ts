import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTaskDeriver, deriveTask, taskSignature } from "../src/lib/derived-tasks.ts";
import { recalculateAllTaskThresholds } from "../src/lib/threshold.ts";
import type { Task } from "../src/lib/types.ts";

function task(id: string, scores: Array<[string, number]>, extra: Partial<Task> = {}): Task {
  return {
    id,
    name: `Scenario ${id}`,
    category: "Click Timing",
    subcategory: "Precision",
    sessions: scores.map(([date, pb], i) => ({ id: `${id}_s${i}`, date, sens: 40, pb, threshold: 0 })),
    ...extra,
  };
}

describe("deriveTask", () => {
  it("recomputes legacy thresholds on a COPY and leaves the snapshot task untouched", () => {
    const raw = task("a", [["2026-10-01", 1000]]);
    const derived = deriveTask(raw);
    assert.equal(derived.sessions[0].threshold, 920);
    assert.equal(raw.sessions[0].threshold, 0, "snapshot não é mutado");
    assert.notEqual(derived, raw);
    assert.notEqual(derived.sessions[0], raw.sessions[0]);
  });

  it("matches recalculateAllTaskThresholds exactly", () => {
    const raw = task("a", [["2026-10-02", 900], ["2026-10-01", 850], ["2026-10-01", 880], ["2026-10-02", 950]]);
    const expected = structuredClone(raw);
    recalculateAllTaskThresholds(expected);
    assert.deepEqual(deriveTask(raw), expected);
  });
});

describe("createTaskDeriver (memo por task)", () => {
  it("only the changed task is recomputed", () => {
    const calls: string[] = [];
    const derive = createTaskDeriver((t) => {
      calls.push(t.id);
      recalculateAllTaskThresholds(t);
    });

    const a = task("a", [["2026-10-01", 1000]]);
    const b = task("b", [["2026-10-01", 500]]);
    const c = task("c", [["2026-10-01", 700]]);
    const first = derive([a, b, c]);
    assert.deepEqual(calls, ["a", "b", "c"]);
    assert.equal(first[1].sessions[0].threshold, 460);

    // novo snapshot: objetos novos (como vindos do Rust), só `b` ganhou uma sessão
    calls.length = 0;
    const b2 = task("b", [["2026-10-01", 500], ["2026-10-02", 600]]);
    const second = derive([structuredClone(a), b2, structuredClone(c)]);
    assert.deepEqual(calls, ["b"]);
    assert.equal(second[0], first[0], "task inalterada mantém a mesma referência");
    assert.equal(second[2], first[2]);
    assert.notEqual(second[1], first[1]);
    assert.equal(second[1].sessions.length, 2);
  });

  it("returns the same array when nothing changed (e.g. only activeTaskId moved)", () => {
    const derive = createTaskDeriver();
    const tasks = [task("a", [["2026-10-01", 1000]]), task("b", [["2026-10-01", 500]])];
    const first = derive(tasks);
    const again = derive(structuredClone(tasks));
    assert.equal(again, first);
    assert.equal(derive.computeCount(), 2);
  });

  it("recomputes when name/category change or a session is deleted/added", () => {
    const derive = createTaskDeriver();
    const base = task("a", [["2026-10-01", 1000], ["2026-10-02", 900]]);
    derive([base]);
    assert.equal(derive.computeCount(), 1);

    derive([{ ...base, name: "Renamed" }]);
    assert.equal(derive.computeCount(), 2);
    derive([{ ...base, name: "Renamed", category: "Other" }]);
    assert.equal(derive.computeCount(), 3);

    const withoutFirst = { ...base, sessions: base.sessions.slice(1) };
    derive([withoutFirst]);
    assert.equal(derive.computeCount(), 4);
    const extra = task("a", [["2026-10-01", 1000], ["2026-10-02", 900], ["2026-10-03", 800]]);
    assert.notEqual(taskSignature(extra), taskSignature(base));
    derive([extra]);
    assert.equal(derive.computeCount(), 5);
  });

  it("drops cache entries for removed tasks and handles empty input", () => {
    const derive = createTaskDeriver();
    const a = task("a", [["2026-10-01", 1000]]);
    derive([a]);
    assert.deepEqual(derive([]), []);
    derive([a]);
    assert.equal(derive.computeCount(), 2, "a voltou: recomputada (cache podado)");
  });
});
