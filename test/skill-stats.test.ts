import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  median,
  mad,
  robustSigma,
  theilSenSlope,
  invNormCdf,
  clamp,
} from "../src/lib/skill/stats.ts";

/** PRNG determinístico (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão via Box-Muller usando um PRNG com seed fixa. */
function gaussians(n: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = Math.max(rnd(), Number.MIN_VALUE);
    const u2 = rnd();
    const r = Math.sqrt(-2 * Math.log(u1));
    out.push(r * Math.cos(2 * Math.PI * u2));
    if (out.length < n) out.push(r * Math.sin(2 * Math.PI * u2));
  }
  return out;
}

describe("median / mad", () => {
  it("median de lista vazia é NaN e de ímpar/par é correta", () => {
    assert.ok(Number.isNaN(median([])));
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
  });

  it("mad = mediana de |x - mediana|", () => {
    assert.equal(mad([1, 2, 3, 4, 100]), 1);
    assert.ok(Number.isNaN(mad([])));
  });
});

describe("robustSigma", () => {
  it("N(0,1) com 10k amostras (seed fixa) ≈ 1 ±0.05", () => {
    const sigma = robustSigma(gaussians(10000, 42));
    assert.ok(Math.abs(sigma - 1) <= 0.05, `sigma=${sigma}`);
  });

  it("ignora outlier grande", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    assert.ok(robustSigma(xs) < 10);
  });
});

describe("theilSenSlope", () => {
  it("n < 2 → 0", () => {
    assert.equal(theilSenSlope([], []), 0);
    assert.equal(theilSenSlope([1], [2]), 0);
  });

  it("reta exata recupera a inclinação", () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2 * x + 1);
    assert.ok(Math.abs(theilSenSlope(xs, ys) - 2) < 1e-12);
  });

  it("ignora 1 outlier em 10 pontos lineares", () => {
    const xs = Array.from({ length: 10 }, (_, i) => i);
    const ys = xs.map((x) => 0.5 * x);
    ys[9] = 500;
    const slope = theilSenSlope(xs, ys);
    assert.ok(Math.abs(slope - 0.5) < 0.05, `slope=${slope}`);
  });
});

describe("invNormCdf (Acklam)", () => {
  it("invNormCdf(0.5) = 0", () => {
    assert.equal(invNormCdf(0.5), 0);
  });

  it("invNormCdf(0.975) ≈ 1.959964", () => {
    assert.ok(Math.abs(invNormCdf(0.975) - 1.959964) < 1e-6);
  });

  it("invNormCdf(0.8333) ≈ 0.9673", () => {
    assert.ok(Math.abs(invNormCdf(0.8333) - 0.9673) < 1e-3);
  });

  it("simetria e caudas (p < 0.02425 e p > 0.97575)", () => {
    assert.ok(Math.abs(invNormCdf(0.01) + invNormCdf(0.99)) < 1e-9);
    assert.ok(Math.abs(invNormCdf(0.001) + invNormCdf(0.999)) < 1e-9);
    assert.ok(Math.abs(invNormCdf(0.001) - -3.090232) < 1e-5);
  });
});

describe("clamp", () => {
  it("limita aos extremos", () => {
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(clamp(0.3, 0, 1), 0.3);
  });
});
