import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTaskDeriver, deriveTask, taskSignature } from "../src/lib/derived-tasks.ts";
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

// Recalc de teste (o ratchet saiu): só marca threshold = 1 para provar a cópia/memo.
const markFirst = (t: Task) => {
  for (const s of t.sessions) s.threshold = 1;
};

describe("deriveTask (Threshold v2: passagem direta por padrão)", () => {
  it("does not recompute Session.threshold: returns the same task", () => {
    const raw = task("a", [["2026-10-01", 1000]]);
    const derived = deriveTask(raw);
    assert.equal(derived, raw);
    assert.equal(derived.sessions[0].threshold, 0, "threshold não é mais escrito");
  });

  it("with an explicit recalc, works on a COPY and leaves the snapshot untouched", () => {
    const raw = task("a", [["2026-10-01", 1000]]);
    const derived = deriveTask(raw, markFirst);
    assert.equal(derived.sessions[0].threshold, 1);
    assert.equal(raw.sessions[0].threshold, 0);
    assert.notEqual(derived, raw);
    assert.notEqual(derived.sessions[0], raw.sessions[0]);
  });
});

describe("createTaskDeriver", () => {
  it("default deriver is a pass-through that preserves array and task references", () => {
    const derive = createTaskDeriver();
    const tasks = [task("a", [["2026-10-01", 1000]]), task("b", [["2026-10-01", 500]])];
    const out = derive(tasks);
    assert.equal(out, tasks);
    assert.equal(out[0], tasks[0]);
    assert.equal(derive.computeCount(), 0);
  });

  it("with recalc: only the changed task is recomputed", () => {
    const calls: string[] = [];
    const derive = createTaskDeriver((t) => {
      calls.push(t.id);
      markFirst(t);
    });

    const a = task("a", [["2026-10-01", 1000]]);
    const b = task("b", [["2026-10-01", 500]]);
    const c = task("c", [["2026-10-01", 700]]);
    const first = derive([a, b, c]);
    assert.deepEqual(calls, ["a", "b", "c"]);

    calls.length = 0;
    const b2 = task("b", [["2026-10-01", 500], ["2026-10-02", 600]]);
    const second = derive([structuredClone(a), b2, structuredClone(c)]);
    assert.deepEqual(calls, ["b"]);
    assert.equal(second[0], first[0], "task inalterada mantém a mesma referência");
    assert.equal(second[2], first[2]);
    assert.notEqual(second[1], first[1]);
    assert.equal(second[1].sessions.length, 2);
  });

  it("with recalc: returns the same array when nothing changed", () => {
    const derive = createTaskDeriver(markFirst);
    const tasks = [task("a", [["2026-10-01", 1000]]), task("b", [["2026-10-01", 500]])];
    const first = derive(tasks);
    const again = derive(structuredClone(tasks));
    assert.equal(again, first);
    assert.equal(derive.computeCount(), 2);
  });

  it("with recalc: recomputes when metadata changes or a session is added/removed; prunes removed tasks", () => {
    const derive = createTaskDeriver(markFirst);
    const base = task("a", [["2026-10-01", 1000], ["2026-10-02", 900]]);
    derive([base]);
    derive([{ ...base, name: "Renamed" }]);
    assert.equal(derive.computeCount(), 2);
    const extra = task("a", [["2026-10-01", 1000], ["2026-10-02", 900], ["2026-10-03", 800]]);
    assert.notEqual(taskSignature(extra), taskSignature(base));
    derive([extra]);
    assert.equal(derive.computeCount(), 3);
    assert.deepEqual(derive([]), []);
    derive([extra]);
    assert.equal(derive.computeCount(), 4, "a voltou: recomputada (cache podado)");
  });
});
