import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  binByLattice,
  kernelSmooth,
  fitQuadraticLog,
  bootstrapVertex,
} from "../src/lib/sens-model.ts";
import { latticeCm, latticeIndex } from "../src/lib/sens-lattice.ts";

describe("sens-model: binByLattice & kernelSmooth", () => {
  it("groups points by lattice index and computes stats", () => {
    const k30 = latticeIndex(30);
    const k40 = latticeIndex(40);

    const points = [
      { k: k30, rel: 1.0 },
      { k: k30, rel: 1.1 },
      { k: k40, rel: 0.9 },
      { k: k40, rel: 0.8 },
      { k: k40, rel: 1.0 },
    ];

    const bins = binByLattice(points);
    assert.equal(bins.length, 2);

    const bin30 = bins.find((b) => b.k === k30)!;
    assert.ok(bin30);
    assert.equal(bin30.n, 2);
    assert.equal(Number(bin30.mean.toFixed(2)), 1.05);
    assert.ok(bin30.sd !== null && bin30.sd > 0);
    assert.ok(bin30.smooth > 0);
    assert.ok(bin30.looSmooth > 0);

    const bin40 = bins.find((b) => b.k === k40)!;
    assert.ok(bin40);
    assert.equal(bin40.n, 3);
    assert.equal(Number(bin40.mean.toFixed(2)), 0.9);
  });

  it("handles empty or invalid inputs gracefully", () => {
    assert.deepEqual(binByLattice([]), []);
    assert.deepEqual(binByLattice([{ k: NaN, rel: 1 }]), []);
  });

  it("kernelSmooth evaluates smooth values across k", () => {
    const points = [
      { k: -5, rel: 0.8 },
      { k: -2, rel: 1.0 },
      { k: 0, rel: 1.2 },
      { k: 3, rel: 0.9 },
    ];
    const bins = binByLattice(points);
    const smoothFn = kernelSmooth(bins, 1.5);

    const valAt0 = smoothFn(0);
    const valAtMinus2 = smoothFn(-2);
    assert.ok(valAt0 > 1.0, `valAt0 was ${valAt0}`);
    assert.ok(valAtMinus2 > 0.8, `valAtMinus2 was ${valAtMinus2}`);
  });
});

describe("sens-model: fitQuadraticLog", () => {
  it("fits synthetic quadratic data with peak near 38 cm within 5%", () => {
    const truePeakCm = 38.0;
    const testSensList = [25, 28, 31, 35, 38, 42, 46, 50, 55];
    const pts: Array<{ cm: number; y: number }> = [];

    // y = 1.0 - 2.0 * (ln(cm / 38))^2 + small noise
    for (const cm of testSensList) {
      for (let run = 0; run < 3; run++) {
        const u = Math.log(cm / truePeakCm);
        const noise = (Math.sin(cm * 10 + run) * 0.02);
        const y = 1.0 - 2.5 * u * u + noise;
        pts.push({ cm, y });
      }
    }

    assert.ok(pts.length >= 12);
    const fit = fitQuadraticLog(pts);
    assert.ok(fit !== null, "fit should not be null");
    assert.ok(fit.vertexCm !== null);
    assert.ok(
      Math.abs(fit.vertexCm - truePeakCm) / truePeakCm < 0.05,
      `Estimated vertex ${fit.vertexCm} is not within 5% of ${truePeakCm}`
    );
    assert.ok(fit.a < 0, "a must be negative");
    assert.ok(fit.r2 > 0.85, `r2 should be high, was ${fit.r2}`);
  });

  it("returns null when points length < 12", () => {
    const pts = [
      { cm: 30, y: 0.9 },
      { cm: 35, y: 1.0 },
      { cm: 40, y: 0.9 },
      { cm: 45, y: 0.8 },
    ];
    assert.equal(fitQuadraticLog(pts), null);
  });

  it("returns null when amplitude in log cm is narrow (< ln(1.25))", () => {
    const pts: Array<{ cm: number; y: number }> = [];
    // Range from 40 to 42 cm -> 42/40 = 1.05 < 1.25
    for (let i = 0; i < 15; i++) {
      const cm = 40 + (i % 3);
      pts.push({ cm, y: 1.0 - Math.pow(cm - 41, 2) * 0.05 });
    }
    assert.equal(fitQuadraticLog(pts), null);
  });

  it("returns null when quadratic curve is convex (a >= 0)", () => {
    const testSensList = [25, 30, 35, 40, 45, 50];
    const pts: Array<{ cm: number; y: number }> = [];
    // Valley curve: y = 0.5 + 2.0 * u^2 (minimum instead of maximum)
    for (const cm of testSensList) {
      for (let run = 0; run < 3; run++) {
        const u = Math.log(cm / 35);
        pts.push({ cm, y: 0.5 + 2.0 * u * u });
      }
    }
    assert.equal(fitQuadraticLog(pts), null);
  });

  it("returns null when vertex lies outside [cmMin, cmMax] extrapolation boundary", () => {
    const testSensList = [30, 32, 34, 36, 38];
    const pts: Array<{ cm: number; y: number }> = [];
    // Peak is far at 60 cm, outside tested range [30, 38]
    for (const cm of testSensList) {
      for (let run = 0; run < 3; run++) {
        const u = Math.log(cm / 60);
        pts.push({ cm, y: 1.0 - 2.0 * u * u });
      }
    }
    assert.equal(fitQuadraticLog(pts), null);
  });

  it("is invariant to score scaling (e.g. x1000)", () => {
    const testSensList = [28, 32, 36, 40, 44, 48];
    const ptsBase: Array<{ cm: number; y: number }> = [];
    const ptsScaled: Array<{ cm: number; y: number }> = [];

    for (const cm of testSensList) {
      for (let run = 0; run < 3; run++) {
        const u = Math.log(cm / 38);
        const y = 1.0 - 1.5 * u * u;
        ptsBase.push({ cm, y });
        ptsScaled.push({ cm, y: y * 1000 });
      }
    }

    const fitBase = fitQuadraticLog(ptsBase)!;
    const fitScaled = fitQuadraticLog(ptsScaled)!;

    assert.ok(fitBase !== null);
    assert.ok(fitScaled !== null);
    assert.equal(fitBase.vertexCm, fitScaled.vertexCm);
    assert.equal(fitBase.r2, fitScaled.r2);
  });

  it("handles single-sens points without throwing exceptions", () => {
    const pts: Array<{ cm: number; y: number }> = [];
    for (let i = 0; i < 20; i++) {
      pts.push({ cm: 35, y: 100 + i });
    }
    assert.equal(fitQuadraticLog(pts), null);
  });
});

describe("sens-model: bootstrapVertex", () => {
  it("reproduces identical confidence intervals with same seed", () => {
    const testSensList = [28, 32, 36, 40, 44, 48];
    const pts: Array<{ cm: number; y: number }> = [];
    for (const cm of testSensList) {
      for (let run = 0; run < 4; run++) {
        const u = Math.log(cm / 37);
        const noise = Math.sin(cm * 7 + run) * 0.03;
        pts.push({ cm, y: 1.0 - 2.0 * u * u + noise });
      }
    }

    const b1 = bootstrapVertex(pts, { b: 50, seed: 1234 });
    const b2 = bootstrapVertex(pts, { b: 50, seed: 1234 });

    assert.ok(b1 !== null);
    assert.ok(b2 !== null);
    assert.equal(b1.low, b2.low);
    assert.equal(b1.high, b2.high);
    assert.equal(b1.validFraction, b2.validFraction);
  });

  it("produces wider confidence interval with higher noise", () => {
    const testSensList = [28, 32, 36, 40, 44, 48];
    const ptsLowNoise: Array<{ cm: number; y: number }> = [];
    const ptsHighNoise: Array<{ cm: number; y: number }> = [];

    for (const cm of testSensList) {
      for (let run = 0; run < 4; run++) {
        const u = Math.log(cm / 38);
        const base = 1.0 - 2.0 * u * u;
        const n1 = Math.sin(cm + run) * 0.01;
        const n2 = Math.sin(cm + run) * 0.12;
        ptsLowNoise.push({ cm, y: base + n1 });
        ptsHighNoise.push({ cm, y: base + n2 });
      }
    }

    const bLow = bootstrapVertex(ptsLowNoise, { b: 80, seed: 42 });
    const bHigh = bootstrapVertex(ptsHighNoise, { b: 80, seed: 42 });

    assert.ok(bLow !== null);
    if (bHigh !== null) {
      const widthLow = bLow.high - bLow.low;
      const widthHigh = bHigh.high - bHigh.low;
      assert.ok(widthHigh >= widthLow, `High noise width ${widthHigh} should be >= low noise ${widthLow}`);
    }
  });
});
