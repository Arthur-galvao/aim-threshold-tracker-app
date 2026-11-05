import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CategoryRange } from "../src/lib/lab/category-range.ts";
import {
  DEFAULT_GAME_WEIGHTS,
  directionalPhrase,
  effectiveWeights,
  suggestForGame,
  verdict,
  weightedGeometricMean,
} from "../src/lib/lab/game-suggestion.ts";
import { findGame } from "../src/lib/lab/games.ts";

function range(
  category: string,
  sub: string,
  center: number,
  lo: number,
  hi: number,
  confidence: CategoryRange["confidence"] = "high",
): CategoryRange {
  return {
    category,
    subcategory: sub,
    centerCm: center,
    loCm: lo,
    hiCm: hi,
    confidence,
    nRuns: 100,
    nSens: 6,
    slowPenaltyPct: 3,
    fastPenaltyPct: 3,
  };
}

describe("pesos padrao", () => {
  it("somam 1 por jogo", () => {
    for (const [id, w] of Object.entries(DEFAULT_GAME_WEIGHTS)) {
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${id}: ${sum}`);
    }
  });
});

describe("media geometrica ponderada", () => {
  it("pesos iguais -> media geometrica simples", () => {
    const g = weightedGeometricMean([
      { value: 30, weight: 1 },
      { value: 60, weight: 1 },
    ]);
    assert.ok(Math.abs(g - Math.sqrt(1800)) < 1e-9);
  });

  it("pesos desiguais puxam para o valor de maior peso", () => {
    const g = weightedGeometricMean([
      { value: 30, weight: 3 },
      { value: 60, weight: 1 },
    ]);
    assert.ok(Math.abs(g - Math.exp((3 * Math.log(30) + Math.log(60)) / 4)) < 1e-9);
    assert.ok(g < Math.sqrt(1800));
  });
});

describe("peso efetivo e sugestao", () => {
  it("divide pelo numero de subcategorias e aplica fator de confianca", () => {
    const eff = effectiveWeights(
      [
        range("Flick Tech", "A", 40, 35, 45, "high"),
        range("Flick Tech", "B", 40, 35, 45, "medium"),
        range("Click Timing", "C", 40, 35, 45, "low"),
        range("Click Timing", "D", 40, 35, 45, "insufficient"),
      ],
      DEFAULT_GAME_WEIGHTS.valorant,
    );
    const byKey = Object.fromEntries(eff.map((e) => [`${e.category}/${e.subcategory}`, e.effectiveWeight]));
    assert.ok(Math.abs(byKey["Flick Tech/A"] - (0.4 / 2) * 1) < 1e-9);
    assert.ok(Math.abs(byKey["Flick Tech/B"] - (0.4 / 2) * 0.6) < 1e-9);
    // "insufficient" nao conta como subcategoria com dado
    assert.ok(Math.abs(byKey["Click Timing/C"] - 0.4 * 0.3) < 1e-9);
    assert.equal(byKey["Click Timing/D"], undefined);
  });

  it("soma < 0.3 -> insufficient", () => {
    const s = suggestForGame([range("Click Timing", "A", 40, 35, 45, "low")], DEFAULT_GAME_WEIGHTS.valorant);
    assert.equal(s.status, "insufficient");
    assert.ok(s.totalWeight < 0.3);
  });

  it("sem dados -> insufficient", () => {
    assert.equal(suggestForGame([], DEFAULT_GAME_WEIGHTS.cs2).status, "insufficient");
  });

  it("categorias sem peso no jogo sao ignoradas (R6 sem Control)", () => {
    const s = suggestForGame(
      [range("Control Tracking", "A", 40, 35, 45), range("Click Timing", "B", 30, 25, 35)],
      DEFAULT_GAME_WEIGHTS.r6,
    );
    assert.equal(s.status, "ok");
    if (s.status === "ok") assert.ok(Math.abs(s.centerCm - 30) < 1e-9);
  });

  it("combina centros e faixa por media geometrica ponderada", () => {
    const s = suggestForGame(
      [range("Click Timing", "A", 30, 25, 35), range("Flick Tech", "B", 60, 50, 70)],
      DEFAULT_GAME_WEIGHTS.valorant, // 0.4 / 0.4
    );
    assert.equal(s.status, "ok");
    if (s.status === "ok") {
      assert.ok(Math.abs(s.centerCm - Math.sqrt(30 * 60)) < 1e-9);
      assert.ok(Math.abs(s.loCm - Math.sqrt(25 * 50)) < 1e-9);
      assert.ok(Math.abs(s.hiCm - Math.sqrt(35 * 70)) < 1e-9);
    }
  });
});

describe("verdict", () => {
  it("dentro da faixa (inclusive nas bordas)", () => {
    assert.deepEqual(verdict(40, 35, 45), { kind: "inside", distancePct: 0 });
    assert.equal(verdict(35, 35, 45).kind, "inside");
    assert.equal(verdict(45, 35, 45).kind, "inside");
  });

  it("cm/360 menor que lo -> mais rapida", () => {
    const v = verdict(28, 35, 45);
    assert.equal(v.kind, "faster_than_range");
    assert.ok(Math.abs(v.distancePct - 25) < 1e-9);
  });

  it("cm/360 maior que hi -> mais lenta", () => {
    const v = verdict(54, 35, 45);
    assert.equal(v.kind, "slower_than_range");
    assert.ok(Math.abs(v.distancePct - 20) < 1e-9);
  });
});

describe("directionalPhrase", () => {
  const game = findGame("valorant")!;
  const ok = suggestForGame(
    [range("Click Timing", "A", 40, 35, 45), range("Flick Tech", "B", 40, 35, 45)],
    DEFAULT_GAME_WEIGHTS.valorant,
  );

  it("insuficiente", () => {
    const p = directionalPhrase({ status: "insufficient", totalWeight: 0, contributions: [] }, game, 800, 40);
    assert.equal(p.key, "lab.phrase.insufficient");
  });

  it("sem sens atual -> apenas faixa", () => {
    const p = directionalPhrase(ok, game, 800);
    assert.equal(p.key, "lab.phrase.range");
    assert.equal(p.params.loCm, "35.0");
    assert.equal(p.params.hiCm, "45.0");
    // 45 cm no Valorant @800 (0.3 aprox) < 35 cm (0.4 aprox)
    assert.ok(Number(p.params.gameLo) < Number(p.params.gameHi));
  });

  it("mais rapida / mais lenta / dentro", () => {
    assert.equal(directionalPhrase(ok, game, 800, 28).key, "lab.phrase.faster");
    assert.equal(directionalPhrase(ok, game, 800, 28).params.pct, "25");
    assert.equal(directionalPhrase(ok, game, 800, 54).key, "lab.phrase.slower");
    assert.equal(directionalPhrase(ok, game, 800, 40).key, "lab.phrase.inside");
  });
});
