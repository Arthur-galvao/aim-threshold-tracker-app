import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankWeaknesses,
  weaknessPriority,
  weaknessSuggestion,
  worstTrend,
  type WeaknessTaskInput,
} from "../src/lib/skill/weakness.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 1);

function task(over: Partial<WeaknessTaskInput> & { taskId: string }): WeaknessTaskInput {
  return {
    category: "Cat",
    subcategory: "Sub",
    trend: "flat",
    hitRate14: 0.5,
    lastTrainedMs: NOW,
    ...over,
  };
}

describe("weaknessPriority", () => {
  it("fórmula: 0.4·T + 0.3·(1−hit) + 0.3·min(1, dias/7)", () => {
    // down, hit 0.2, 3.5 dias → 0.4 + 0.24 + 0.15
    assert.ok(Math.abs(weaknessPriority("down", 0.2, 3.5) - 0.79) < 1e-12);
  });

  it("componentes de tendência: down=1, flat=0.6, insufficient=0.6, up=0", () => {
    assert.ok(Math.abs(weaknessPriority("down", 1, 0) - 0.4) < 1e-12);
    assert.ok(Math.abs(weaknessPriority("flat", 1, 0) - 0.24) < 1e-12);
    assert.ok(Math.abs(weaknessPriority("insufficient", 1, 0) - 0.24) < 1e-12);
    assert.ok(Math.abs(weaknessPriority("up", 1, 0) - 0) < 1e-12);
  });

  it("hitRate null → 0.5; dias null → recência 1", () => {
    assert.ok(Math.abs(weaknessPriority("down", null, null) - (0.4 + 0.15 + 0.3)) < 1e-12);
  });

  it("recência satura em 7 dias e não fica negativa", () => {
    assert.equal(weaknessPriority("up", 1, 7), weaknessPriority("up", 1, 100));
    assert.equal(weaknessPriority("up", 1, -5), weaknessPriority("up", 1, 0));
  });
});

describe("worstTrend", () => {
  it("down > flat > insufficient > up", () => {
    assert.equal(worstTrend(["up", "flat", "down"]), "down");
    assert.equal(worstTrend(["up", "flat"]), "flat");
    assert.equal(worstTrend(["up", "insufficient"]), "insufficient");
    assert.equal(worstTrend(["up", "up"]), "up");
  });

  it("lista vazia → insufficient", () => {
    assert.equal(worstTrend([]), "insufficient");
  });
});

describe("weaknessSuggestion", () => {
  it("refine se hitRate < 0.35, independente da tendência", () => {
    assert.equal(weaknessSuggestion("up", 0.34), "refine");
    assert.equal(weaknessSuggestion("flat", 0.2), "refine");
  });

  it("hitRate exatamente 0.35 não é refine", () => {
    assert.equal(weaknessSuggestion("down", 0.35), null);
  });

  it("stress se flat e hitRate > 0.6", () => {
    assert.equal(weaknessSuggestion("flat", 0.7), "stress");
  });

  it("hitRate exatamente 0.6 não é stress; não-flat não é stress", () => {
    assert.equal(weaknessSuggestion("flat", 0.6), null);
    assert.equal(weaknessSuggestion("up", 0.9), null);
    assert.equal(weaknessSuggestion("down", 0.9), null);
    assert.equal(weaknessSuggestion("insufficient", 0.9), null);
  });

  it("hitRate null → sem sugestão", () => {
    assert.equal(weaknessSuggestion("flat", null), null);
    assert.equal(weaknessSuggestion("down", null), null);
  });
});

describe("rankWeaknesses", () => {
  it("agrega cenários por subcategoria (pior tendência, média de hit, treino mais recente)", () => {
    const items = rankWeaknesses(
      [
        task({ taskId: "a", subcategory: "Flick", trend: "up", hitRate14: 0.2, lastTrainedMs: NOW - 10 * DAY }),
        task({ taskId: "b", subcategory: "Flick", trend: "down", hitRate14: 0.4, lastTrainedMs: NOW - 2 * DAY }),
      ],
      NOW,
    );
    assert.equal(items.length, 1);
    const [it] = items;
    assert.deepEqual(it.taskIds, ["a", "b"]);
    assert.equal(it.trend, "down");
    assert.ok(Math.abs(it.hitRate14! - 0.3) < 1e-12);
    assert.ok(Math.abs(it.daysSinceTrained! - 2) < 1e-9);
    assert.equal(it.suggestion, "refine");
  });

  it("hitRate null em todos os cenários → hitRate14 null e dias null se nunca treinado", () => {
    const [it] = rankWeaknesses(
      [task({ taskId: "a", hitRate14: null, lastTrainedMs: null, trend: "insufficient" })],
      NOW,
    );
    assert.equal(it.hitRate14, null);
    assert.equal(it.daysSinceTrained, null);
    assert.equal(it.suggestion, null);
    assert.ok(Math.abs(it.priority - (0.24 + 0.15 + 0.3)) < 1e-12);
  });

  it("ordena por prioridade desc e limita a top 3 (padrão)", () => {
    const tasks: WeaknessTaskInput[] = ["A", "B", "C", "D", "E"].map((s, i) =>
      task({ taskId: s, subcategory: s, trend: "down", hitRate14: 0.1 * (i + 1), lastTrainedMs: NOW }),
    );
    const items = rankWeaknesses(tasks, NOW);
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((i) => i.subcategory),
      ["A", "B", "C"],
    );
    assert.ok(items[0].priority >= items[1].priority && items[1].priority >= items[2].priority);
  });

  it("topN customizado e topN 0", () => {
    const tasks = ["A", "B"].map((s) => task({ taskId: s, subcategory: s }));
    assert.equal(rankWeaknesses(tasks, NOW, 1).length, 1);
    assert.equal(rankWeaknesses(tasks, NOW, 0).length, 0);
  });

  it("subcategorias com mesmo nome em categorias diferentes não se misturam", () => {
    const items = rankWeaknesses(
      [
        task({ taskId: "a", category: "X", subcategory: "Flick" }),
        task({ taskId: "b", category: "Y", subcategory: "Flick" }),
      ],
      NOW,
      10,
    );
    assert.equal(items.length, 2);
    assert.ok(items.every((i) => i.taskIds.length === 1));
  });

  it("empate de prioridade → ordem alfabética por subcategoria", () => {
    const items = rankWeaknesses(
      [task({ taskId: "z", subcategory: "Zeta" }), task({ taskId: "a", subcategory: "Alfa" })],
      NOW,
    );
    assert.deepEqual(
      items.map((i) => i.subcategory),
      ["Alfa", "Zeta"],
    );
  });

  it("lista vazia → vazio", () => {
    assert.deepEqual(rankWeaknesses([], NOW), []);
  });
});
