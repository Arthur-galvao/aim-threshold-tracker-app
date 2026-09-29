import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  valorantToCm360,
  formatSensitivity,
  calculateParabolicTrendline,
  computeSweetSpotAnalytics,
  fitParabolaCoefficients,
  fitWeightedParabolaCoefficients,
  recencyWeight,
  poolCategoryRuns,
  predictOptimalSensitivity,
  PREDICTOR_PROFILES,
  type CategoryRunPoint,
  type RunDataPoint,
} from "../src/lib/sens-analytics.ts";
import { getDisplaySens, getRecommendedSens } from "../src/lib/viscose.ts";

describe("sens-analytics", () => {
  describe("valorantToCm360", () => {
    it("converts Valorant sensitivity to cm/360 at 800 DPI", () => {
      const cm68 = valorantToCm360(0.24013, 800);
      assert.ok(Math.abs(cm68 - 68.0) < 0.1, `Expected ~68.0, got ${cm68}`);

      const cm50 = valorantToCm360(0.32676, 800);
      assert.ok(Math.abs(cm50 - 50.0) < 0.1, `Expected ~50.0, got ${cm50}`);
    });

    it("leaves already converted cm/360 values intact", () => {
      assert.equal(valorantToCm360(40.0), 40.0);
      assert.equal(valorantToCm360(25.5), 25.5);
    });

    it("handles invalid or non-positive values gracefully", () => {
      assert.equal(valorantToCm360(0), 0);
      assert.equal(valorantToCm360(-5), -5);
    });
  });

  describe("formatSensitivity", () => {
    it("formats integer cm/360 values without decimal places", () => {
      assert.equal(formatSensitivity(50), "50 cm");
      assert.equal(formatSensitivity(40.0), "40 cm");
    });

    it("formats decimal cm/360 values with 1 decimal place", () => {
      assert.equal(formatSensitivity(42.5), "42.5 cm");
    });

    it("returns dash for invalid or zero sensitivity", () => {
      assert.equal(formatSensitivity(0), "-");
      assert.equal(formatSensitivity(-1), "-");
    });
  });

  describe("calculateParabolicTrendline", () => {
    it("returns empty array when fewer than 4 points are supplied", () => {
      const points = [
        { x: 30, y: 100 },
        { x: 40, y: 120 },
      ];
      const trend = calculateParabolicTrendline(points);
      assert.deepEqual(trend, []);
    });

    it("fits a parabola to quadratic data points", () => {
      // y = -(x - 40)^2 + 100 => vertex at x=40, y=100
      const points = [
        { x: 30, y: 0 },
        { x: 35, y: 75 },
        { x: 40, y: 100 },
        { x: 45, y: 75 },
        { x: 50, y: 0 },
      ];
      const trend = calculateParabolicTrendline(points, 20);
      assert.ok(trend.length > 0);
      const peakPoint = trend.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), trend[0]);
      assert.ok(Math.abs(peakPoint.x - 40) <= 2, `Expected peak near 40, got ${peakPoint.x}`);
      assert.ok(peakPoint.y >= 90, `Expected peak y >= 90, got ${peakPoint.y}`);
    });
  });

  describe("computeSweetSpotAnalytics", () => {
    it("returns null when sessions list is empty", () => {
      assert.equal(computeSweetSpotAnalytics([]), null);
    });

    it("groups by specific sensitivities instead of ranges", () => {
      const runs = [
        { sens: 67.5, score: 95 },
        { sens: 67.5, score: 97 },
        { sens: 67.5, score: 96 },
        { sens: 50.0, score: 90 },
        { sens: 108.4, score: 85 },
      ];

      const analysis = computeSweetSpotAnalytics(runs);
      assert.ok(analysis !== null);
      assert.equal(analysis.totalRuns, 5);

      // Best entry should be specific sensitivity 67.5 cm
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.sens, 67.5);
      assert.equal(analysis.bestBucket.rangeLabel, "67.5 cm");
      assert.equal(analysis.bestBucket.count, 3);

      // Buckets should NOT have range formats like "65 - 70 cm"
      for (const bucket of analysis.buckets) {
        assert.ok(!bucket.rangeLabel.includes("-"), `rangeLabel should not be a range: ${bucket.rangeLabel}`);
        assert.equal(typeof bucket.sens, "number");
      }

      const sens50 = analysis.buckets.find((b) => b.sens === 50.0);
      assert.ok(sens50 !== undefined);
      assert.equal(sens50.rangeLabel, "50 cm");
      assert.equal(sens50.count, 1);
    });

    it("applies Bayesian shrinkage and sample variance correctly across specific sensitivities", () => {
      const runs = [
        // 68 cm: 5 runs, high scores, high consistency
        { sens: 68.0, score: 98 },
        { sens: 68.0, score: 99 },
        { sens: 68.0, score: 97 },
        { sens: 68.0, score: 98.5 },
        { sens: 68.0, score: 97.5 },
        // 50 cm: 1 lucky run with 100 score
        { sens: 50.0, score: 100 },
      ];

      const analysis = computeSweetSpotAnalytics(runs);
      assert.ok(analysis !== null);
      assert.equal(analysis.totalRuns, 6);

      // Best bucket should be specific 68.0 cm due to sample qualification and Bayesian shrinkage
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.sens, 68.0);
      assert.equal(analysis.bestBucket.rangeLabel, "68 cm");
      assert.equal(analysis.bestBucket.count, 5);
      assert.ok(analysis.bestBucket.stdDev !== null && analysis.bestBucket.stdDev < 2);
      assert.ok(analysis.bestBucket.confidenceLevel === "medium");

      // Single-run specific sensitivity should have insufficient confidence
      const single = analysis.buckets.find((b) => b.sens === 50.0);
      assert.ok(single !== undefined);
      assert.equal(single.count, 1);
      assert.equal(single.stdDev, null);
      assert.equal(single.consistency, null);
      assert.equal(single.confidenceLevel, "insufficient");
    });
  });

  describe("predictOptimalSensitivity", () => {
    it("returns null when runs array is empty", () => {
      assert.equal(predictOptimalSensitivity([]), null);
    });

    it("predicts optimal sensitivity combining parabolic apex and empirical sweet spot", () => {
      // Create a quadratic curve peaking around 60 cm: y = -(x-60)^2 + 1000
      const runs = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];

      const prediction = predictOptimalSensitivity(runs);
      assert.ok(prediction !== null);
      assert.ok(typeof prediction.predictedSens === "number");
      // The predicted sensitivity should be close to 60 cm
      assert.ok(Math.abs(prediction.predictedSens - 60.0) <= 2.5);
      assert.ok(prediction.label.includes("cm"));
      assert.ok(prediction.confidence === "medium" || prediction.confidence === "high");
      assert.ok(prediction.vertexSens !== null && Math.abs(prediction.vertexSens - 60.0) <= 1.0);
    });

    it("marks confidence as insufficient when fewer than 5 runs are supplied", () => {
      const runs = [
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 950 },
        { sens: 60.0, score: 920 },
      ];

      const prediction = predictOptimalSensitivity(runs);
      assert.ok(prediction !== null);
      assert.equal(prediction.confidence, "insufficient");
    });

    it("falls back gracefully to empirical best when parabolic vertex is convex or invalid", () => {
      // Linear or flat distribution: y = x + 100
      const runs = [
        { sens: 40.0, score: 140 },
        { sens: 50.0, score: 150 },
        { sens: 60.0, score: 160 },
        { sens: 70.0, score: 170 },
        { sens: 80.0, score: 180 },
        { sens: 80.0, score: 182 },
      ];

      const prediction = predictOptimalSensitivity(runs);
      assert.ok(prediction !== null);
      // Empirical best is 80 cm
      assert.equal(prediction.empiricalSens, 80.0);
      assert.ok(Math.abs(prediction.predictedSens - 80.0) < 5.0);
    });

    it("applies customizable profile weights correctly", () => {
      // Curve with vertex at ~68.9 cm, but high-count empirical stability at 50 cm
      const runs = [
        { sens: 40, score: 800 },
        { sens: 50, score: 920 },
        { sens: 50, score: 920 },
        { sens: 50, score: 920 },
        { sens: 50, score: 920 },
        { sens: 50, score: 920 },
        { sens: 60, score: 960 },
        { sens: 70, score: 980 },
        { sens: 80, score: 960 },
        { sens: 90, score: 900 },
      ];

      const predDefault = predictOptimalSensitivity(runs, "equilibrado");
      const predNeutral = predictOptimalSensitivity(runs, "neutro");
      const predTheoretical = predictOptimalSensitivity(runs, "teorico");
      const predConsistency = predictOptimalSensitivity(runs, "consistencia");

      assert.ok(predDefault && predNeutral && predTheoretical && predConsistency);
      assert.equal(predDefault.profile, "equilibrado");
      assert.equal(predNeutral.profile, "neutro");
      assert.equal(predTheoretical.profile, "teorico");
      assert.equal(predConsistency.profile, "consistencia");

      // Theoretical apex is > empirical best (50 cm), so higher theoretical weight must produce higher predicted sensitivity
      assert.ok(
        predTheoretical.predictedSens > predDefault.predictedSens,
        `Theoretical (${predTheoretical.predictedSens}) should be > Default (${predDefault.predictedSens})`
      );
      assert.ok(
        predDefault.predictedSens > predNeutral.predictedSens,
        `Default (${predDefault.predictedSens}) should be > Neutral (${predNeutral.predictedSens})`
      );
      assert.ok(
        predNeutral.predictedSens > predConsistency.predictedSens,
        `Neutral (${predNeutral.predictedSens}) should be > Consistency (${predConsistency.predictedSens})`
      );
    });
  });

  describe("fitWeightedParabolaCoefficients", () => {
    it("produces identical results to fitParabolaCoefficients when all weights are 1", () => {
      const points = [
        { x: 30, y: 0 },
        { x: 35, y: 75 },
        { x: 40, y: 100 },
        { x: 45, y: 75 },
        { x: 50, y: 0 },
      ];
      const unweighted = fitParabolaCoefficients(points);
      const weightedAll1 = fitWeightedParabolaCoefficients(
        points.map((p) => ({ ...p, weight: 1 }))
      );
      assert.ok(unweighted !== null);
      assert.ok(weightedAll1 !== null);
      assert.ok(Math.abs(unweighted.a - weightedAll1.a) < 1e-9);
      assert.ok(Math.abs(unweighted.b - weightedAll1.b) < 1e-9);
      assert.ok(Math.abs(unweighted.c - weightedAll1.c) < 1e-9);
      assert.equal(unweighted.vertex, weightedAll1.vertex);
    });

    it("approaches uncorrupted vertex when setting weight 0 on an extreme outlier", () => {
      // Vertex at 40
      const cleanPoints = [
        { x: 30, y: 0 },
        { x: 35, y: 75 },
        { x: 40, y: 100 },
        { x: 45, y: 75 },
        { x: 50, y: 0 },
      ];
      const cleanResult = fitWeightedParabolaCoefficients(cleanPoints);
      assert.ok(cleanResult && cleanResult.vertex !== null);
      assert.equal(cleanResult.vertex, 40);

      // Outlier that pulls the concave peak towards ~43
      const corruptedPoints = [
        ...cleanPoints.map((p) => ({ ...p, weight: 1 })),
        { x: 48, y: 150, weight: 1 },
      ];
      const corruptedResult = fitWeightedParabolaCoefficients(corruptedPoints);
      assert.ok(corruptedResult && corruptedResult.vertex !== null);
      // Vertex with outlier is displaced from 40
      assert.ok(Math.abs(corruptedResult.vertex - 40) > 0.5);

      // Weight 0 suppresses outlier
      const suppressedPoints = [
        ...cleanPoints.map((p) => ({ ...p, weight: 1 })),
        { x: 48, y: 150, weight: 0 },
      ];
      const suppressedResult = fitWeightedParabolaCoefficients(suppressedPoints);
      assert.ok(suppressedResult && suppressedResult.vertex !== null);
      assert.ok(Math.abs(suppressedResult.vertex - 40) < 0.2);
    });
  });

  describe("recencyWeight", () => {
    const DAY_MS = 86_400_000;
    const now = new Date("2026-09-24T12:00:00Z").getTime();

    it("returns 1 if dateIso is undefined, invalid or halfLifeDays <= 0", () => {
      assert.equal(recencyWeight(undefined, now, 60), 1);
      assert.equal(recencyWeight("invalid-date", now, 60), 1);
      assert.equal(recencyWeight("2026-09-20T00:00:00Z", now, 0), 1);
      assert.equal(recencyWeight("2026-09-20T00:00:00Z", now, -10), 1);
    });

    it("returns 1 for dates in the future (ageDays <= 0)", () => {
      const tomorrow = new Date(now + DAY_MS).toISOString();
      assert.equal(recencyWeight(tomorrow, now, 60), 1);
    });

    it("calculates exponential decay correctly based on half life", () => {
      const exact60DaysAgo = new Date(now - 60 * DAY_MS).toISOString();
      const weight60 = recencyWeight(exact60DaysAgo, now, 60);
      assert.ok(Math.abs(weight60 - 0.5) < 1e-4);

      const exact120DaysAgo = new Date(now - 120 * DAY_MS).toISOString();
      const weight120 = recencyWeight(exact120DaysAgo, now, 60);
      assert.ok(Math.abs(weight120 - 0.25) < 1e-4);

      const today = new Date(now).toISOString();
      assert.equal(recencyWeight(today, now, 60), 1);
    });
  });

  describe("poolCategoryRuns", () => {
    it("flattens runs from multiple tasks belonging to the same category", () => {
      const runsByTask: Record<string, CategoryRunPoint[]> = {
        task1: [
          { taskId: "task1", sens: 45, score: 100 },
          { taskId: "task1", sens: 50, score: 120 },
        ],
        task2: [
          { taskId: "task2", sens: 55, score: 110 },
        ],
      };
      const pooled = poolCategoryRuns(runsByTask);
      assert.equal(pooled.length, 3);
      assert.equal(pooled[0].taskId, "task1");
      assert.equal(pooled[2].taskId, "task2");
    });
  });

  describe("predictOptimalSensitivity with hierarchical group prior", () => {
    it("preserves identical output when options is omitted (backward compatibility)", () => {
      const runs = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];
      const withoutOptions = predictOptimalSensitivity(runs);
      const withEmptyOptions = predictOptimalSensitivity(runs, "equilibrado", {});
      assert.deepEqual(withoutOptions, withEmptyOptions);
    });

    it("shrinks local prediction towards category group when local sample is small (3 runs)", () => {
      // Local task with only 3 runs around 40 cm (insufficient for curvature)
      const localRuns = [
        { sens: 40.0, score: 100 },
        { sens: 40.0, score: 102 },
        { sens: 42.0, score: 101 },
      ];

      // Group runs from sister scenarios in same subcategory peaking strongly around 60 cm
      const groupRuns = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];

      const localOnly = predictOptimalSensitivity(localRuns);
      assert.ok(localOnly);
      assert.equal(localOnly.predictedSens, 40.0);
      assert.equal(localOnly.confidence, "insufficient");

      // With group runs: n_local = 3, k = 6 => peso_local = 3 / 9 = 0.333
      // groupPred ~ 60 cm
      // blended should be pulled significantly toward 60 cm
      const blended = predictOptimalSensitivity(localRuns, "equilibrado", {
        groupRuns,
        shrinkageK: 6,
      });

      assert.ok(blended);
      assert.ok(
        blended.predictedSens > 50,
        `Expected blended prediction pulled toward group apex (~60), got ${blended.predictedSens}`
      );
      assert.ok(blended.confidence !== "insufficient");
    });

    it("allows local prediction to dominate when local sample is large (25 runs)", () => {
      // Local scenario with 25 runs peaking at 45 cm
      const localRuns: RunDataPoint[] = [];
      for (let i = 0; i < 5; i++) {
        localRuns.push({ sens: 35.0, score: 700 });
        localRuns.push({ sens: 40.0, score: 850 });
        localRuns.push({ sens: 45.0, score: 1000 });
        localRuns.push({ sens: 50.0, score: 850 });
        localRuns.push({ sens: 55.0, score: 700 });
      }

      // Group runs peaking at 65 cm
      const groupRuns: RunDataPoint[] = [
        { sens: 50.0, score: 700 },
        { sens: 55.0, score: 850 },
        { sens: 65.0, score: 1000 },
        { sens: 75.0, score: 850 },
        { sens: 80.0, score: 700 },
      ];

      const localOnly = predictOptimalSensitivity(localRuns);
      assert.ok(localOnly);

      const blended = predictOptimalSensitivity(localRuns, "equilibrado", {
        groupRuns,
        shrinkageK: 6,
      });

      assert.ok(blended);
      assert.ok(
        Math.abs(blended.predictedSens - localOnly.predictedSens) <= 4.0,
        `Expected local dominance near ${localOnly.predictedSens}, got ${blended.predictedSens}`
      );
      assert.equal(blended.confidence, "high");
    });

    it("supports evaluating pure groupRuns when local runs array is empty", () => {
      const groupRuns = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];

      const pred = predictOptimalSensitivity([], "equilibrado", { groupRuns });
      assert.ok(pred !== null);
      assert.ok(Math.abs(pred.predictedSens - 60.0) <= 2.5);
      assert.ok(pred.confidence !== "insufficient");
    });
  });

  describe("getDisplaySens", () => {
    it("returns viscose source and static recommendation when groupRuns has fewer than 8 runs", () => {
      const fewRuns = [
        { sens: 45, score: 100 },
        { sens: 50, score: 105 },
        { sens: 55, score: 110 },
      ];
      const result = getDisplaySens("Control Tracking", "Wrist", fewRuns);
      assert.equal(result.source, "viscose");
      assert.equal(result.value, getRecommendedSens("Control Tracking", "Wrist"));
    });

    it("returns viscose source when groupRuns is undefined", () => {
      const result = getDisplaySens("Click Timing", "Precision");
      assert.equal(result.source, "viscose");
      assert.equal(result.value, 60);
    });

    it("returns predicted source when groupRuns has >= 8 runs with sufficient confidence", () => {
      const groupRuns = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];
      const result = getDisplaySens("Click Timing", "Precision", groupRuns);
      assert.equal(result.source, "predicted");
      assert.ok(Math.abs(result.value - 60.0) <= 2.5);
    });
  });
});
