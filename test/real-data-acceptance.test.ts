import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRunPoints } from "../src/lib/run-points.ts";
import { predictOptimalSensitivity, type RunDataPoint } from "../src/lib/sens-analytics.ts";
import type { Task } from "../src/lib/types.ts";

describe("real-data acceptance tests (C5)", () => {
  const fixturePath = new URL("./fixtures/wallhack-vbrclick-easy.json", import.meta.url);
  const fixture: Task = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const points = buildRunPoints([fixture], { dpi: 800 });

  it("produces 94 eligible runs", () => {
    assert.equal(points.length, 94);
  });

  it("verifies 21 distinct sensitivities in the last 21 continuously randomized runs", () => {
    const last21 = points.slice(-21);
    assert.equal(last21.length, 21);
    const distinctSens = new Set(last21.map((p) => p.sens));
    assert.equal(distinctSens.size, 21);
  });

  describe("regional average performance after C2 backfitting", () => {
    interface RegionSpec {
      name: string;
      filter: (p: { sens: number }) => boolean;
      expectedCount: number;
      expectedRawScore: number;
      expectedPerf: number;
      expectedRel: number;
    }

    const regions: RegionSpec[] = [
      {
        name: "< 45 cm",
        filter: (p) => p.sens < 45,
        expectedCount: 12,
        expectedRawScore: 1019,
        expectedPerf: -0.6,
        expectedRel: 99.4,
      },
      {
        name: "49 a 51 cm",
        filter: (p) => p.sens >= 49 && p.sens <= 51,
        expectedCount: 41,
        expectedRawScore: 1002,
        expectedPerf: -2.4,
        expectedRel: 97.6,
      },
      {
        name: "51 a 60 cm",
        filter: (p) => p.sens > 51 && p.sens <= 60,
        expectedCount: 8,
        expectedRawScore: 994,
        expectedPerf: 0.4,
        expectedRel: 100.4,
      },
      {
        name: "60 a 70 cm",
        filter: (p) => p.sens > 60 && p.sens <= 70,
        expectedCount: 18,
        expectedRawScore: 1039,
        expectedPerf: 3.8,
        expectedRel: 103.8,
      },
      {
        name: "70 a 80 cm",
        filter: (p) => p.sens >= 70 && p.sens < 80,
        expectedCount: 8,
        expectedRawScore: 976,
        expectedPerf: -0.1,
        expectedRel: 99.9,
      },
      {
        name: "80 a 120 cm",
        filter: (p) => p.sens >= 80 && p.sens <= 120,
        expectedCount: 7,
        expectedRawScore: 1044,
        expectedPerf: 2.9,
        expectedRel: 102.9,
      },
    ];

    for (const reg of regions) {
      it(`evaluates region ${reg.name} with expected counts and tolerances (+-1.5 pp)`, () => {
        const matching = points.filter(reg.filter);
        assert.equal(
          matching.length,
          reg.expectedCount,
          `Region ${reg.name} expected ${reg.expectedCount} runs, got ${matching.length}`
        );

        const avgRaw = matching.reduce((sum, p) => sum + p.score, 0) / matching.length;
        const avgRel = matching.reduce((sum, p) => sum + p.rel, 0) / matching.length;
        const perf = avgRel - 100;

        assert.ok(
          Math.abs(avgRaw - reg.expectedRawScore) <= 5,
          `Region ${reg.name} avg raw score ${avgRaw} differs from expected ~${reg.expectedRawScore}`
        );

        // Tolerance +-1.5 percentage points
        assert.ok(
          Math.abs(perf - reg.expectedPerf) <= 1.5,
          `Region ${reg.name} performance ${perf.toFixed(2)}% differs from expected ~${reg.expectedPerf}% by more than 1.5 pp`
        );

        assert.ok(
          Math.abs(avgRel - reg.expectedRel) <= 1.5,
          `Region ${reg.name} relative score ${avgRel.toFixed(2)} differs from expected ~${reg.expectedRel} by more than 1.5 pp`
        );
      });
    }
  });

  describe("neutral profile prediction", () => {
    const taskRuns: RunDataPoint[] = points.map((p) => ({
      sens: p.sens,
      score: p.score,
      rawScore: p.score,
      normScore: p.rel,
      date: p.date,
      scenario: p.scenario,
      threshold: p.threshold,
    }));

    it("predicts sensitivity in [63.8, 70.4] cm with peak at 67.0 cm, low confidence, and rejected vertex", () => {
      const pred = predictOptimalSensitivity(taskRuns, "neutro");
      assert.ok(pred !== null, "Prediction must not be null");

      // Peak between 63.8 and 70.4 cm, centered around 67.0 cm
      assert.ok(
        pred.predictedSens >= 63.8 && pred.predictedSens <= 70.4,
        `predictedSens ${pred.predictedSens} expected between 63.8 and 70.4 cm`
      );
      assert.equal(pred.predictedSens, 67.0);

      // Rigorously assert confidence is low, and never medium or high
      assert.equal(pred.confidence, "low");
      assert.notEqual(pred.confidence, "medium");
      assert.notEqual(pred.confidence, "high");

      // Parabolic vertex must be rejected due to guards
      assert.equal(pred.vertexSens, null);
    });

    it("verifies prediction consistency using detrended relative scores (rel)", () => {
      const relRuns: RunDataPoint[] = points.map((p) => ({
        sens: p.sens,
        score: p.rel,
        rawScore: p.score,
        normScore: p.rel,
        date: p.date,
        scenario: p.scenario,
      }));

      const pred = predictOptimalSensitivity(relRuns, "neutro");
      assert.ok(pred !== null, "Prediction with rel must not be null");

      assert.ok(
        pred.predictedSens >= 63.8 && pred.predictedSens <= 70.4,
        `predictedSens ${pred.predictedSens} expected between 63.8 and 70.4 cm`
      );
      assert.equal(pred.predictedSens, 67.0);

      assert.equal(pred.confidence, "low");
      assert.notEqual(pred.confidence, "medium");
      assert.notEqual(pred.confidence, "high");
      assert.equal(pred.vertexSens, null);
    });
  });
});
