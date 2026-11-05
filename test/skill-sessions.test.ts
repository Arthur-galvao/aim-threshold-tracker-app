import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "../src/lib/types.ts";
import {
  runTime,
  groupTrainingSessions,
  sessionKey,
  type RunRef,
} from "../src/lib/skill/sessions.ts";

function sess(id: string, datetime?: string, date = "2026-03-01"): Session {
  return { id, date, sens: 1, pb: 100, threshold: 0, datetime };
}

function ref(taskId: string, s: Session, index = 0): RunRef {
  return { taskId, session: s, t: runTime(s, index) };
}

describe("runTime", () => {
  it("datetime local é interpretado como horário local", () => {
    const s = sess("a", "2026-03-01T10:30:00");
    assert.equal(runTime(s), new Date(2026, 2, 1, 10, 30, 0).getTime());
  });

  it("sem datetime: date às 12:00 local + índice em ms (preserva ordem)", () => {
    const s = sess("b", undefined, "2026-03-01");
    const base = new Date(2026, 2, 1, 12, 0, 0).getTime();
    assert.equal(runTime(s), base);
    assert.equal(runTime(s, 0), base);
    assert.equal(runTime(s, 5), base + 5);
    assert.ok(runTime(s, 1) > runTime(s, 0));
  });
});

describe("groupTrainingSessions", () => {
  it("gap de 44 min junta, 46 min separa", () => {
    const a = ref("t1", sess("1", "2026-03-01T10:00:00"));
    const b = ref("t1", sess("2", "2026-03-01T10:44:00"));
    const c = ref("t1", sess("3", "2026-03-01T11:30:00")); // 46 min após b
    const groups = groupTrainingSessions([c, a, b]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].map((r) => r.session.id), ["1", "2"]);
    assert.deepEqual(groups[1].map((r) => r.session.id), ["3"]);
  });

  it("gapMin configurável", () => {
    const a = ref("t1", sess("1", "2026-03-01T10:00:00"));
    const b = ref("t1", sess("2", "2026-03-01T10:20:00"));
    assert.equal(groupTrainingSessions([a, b], 15).length, 2);
    assert.equal(groupTrainingSessions([a, b], 30).length, 1);
  });

  it("runs de cenários diferentes intercaladas ficam no mesmo grupo", () => {
    const a = ref("cenarioA", sess("1", "2026-03-01T10:00:00"));
    const b = ref("cenarioB", sess("2", "2026-03-01T10:05:00"));
    const c = ref("cenarioA", sess("3", "2026-03-01T10:12:00"));
    const groups = groupTrainingSessions([a, b, c]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].length, 3);
    assert.deepEqual(groups[0].map((r) => r.taskId), ["cenarioA", "cenarioB", "cenarioA"]);
  });

  it("runs legadas agrupam por date, um grupo por date", () => {
    const d1a = ref("t1", sess("1", undefined, "2026-03-01"), 0);
    const d1b = ref("t1", sess("2", undefined, "2026-03-01"), 1);
    const d2a = ref("t1", sess("3", undefined, "2026-03-02"), 2);
    const groups = groupTrainingSessions([d1a, d2a, d1b]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].map((r) => r.session.id), ["1", "2"]);
    assert.deepEqual(groups[1].map((r) => r.session.id), ["3"]);
  });

  it("legado não se mistura com datetime no mesmo horário", () => {
    const legacy = ref("t1", sess("L", undefined, "2026-03-01"), 0);
    const dated = ref("t1", sess("D", "2026-03-01T12:00:00"));
    const groups = groupTrainingSessions([legacy, dated]);
    assert.equal(groups.length, 2);
    const ids = groups.map((g) => g.map((r) => r.session.id));
    assert.ok(ids.some((g) => g.length === 1 && g[0] === "L"));
    assert.ok(ids.some((g) => g.length === 1 && g[0] === "D"));
  });

  it("ordem preservada: grupos em ordem cronológica e runs dentro do grupo por t", () => {
    const r3 = ref("t1", sess("3", "2026-03-03T09:00:00"));
    const r1 = ref("t1", sess("1", "2026-03-01T09:00:00"));
    const r2 = ref("t1", sess("2", "2026-03-01T09:10:00"));
    const groups = groupTrainingSessions([r3, r2, r1]);
    assert.deepEqual(groups.map((g) => g.map((r) => r.session.id)), [["1", "2"], ["3"]]);
  });

  it("entrada vazia → nenhum grupo", () => {
    assert.deepEqual(groupTrainingSessions([]), []);
  });
});

describe("sessionKey", () => {
  it("é o ISO do primeiro run do grupo", () => {
    const a = ref("t1", sess("1", "2026-03-01T10:00:00"));
    const b = ref("t1", sess("2", "2026-03-01T10:10:00"));
    assert.equal(sessionKey([a, b]), new Date(a.t).toISOString());
  });
});
