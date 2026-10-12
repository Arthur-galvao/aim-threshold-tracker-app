import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  valorantToCm360,
  cm360ToValorant,
  cm360ToSource,
  formatSensitivity,
  calculateParabolicTrendline,
  computeSweetSpotAnalytics,
  fitParabolaCoefficients,
  fitWeightedParabolaCoefficients,
  recencyWeight,
  poolCategoryRuns,
  predictOptimalSensitivity,
  predictSens,
  suggestRecenter,
  PREDICTOR_PROFILES,
  computePlaylistSensStats,
  getScenarioIdealSens,
  type CategoryRunPoint,
  type RunDataPoint,
  type PlaylistCategorySlice,
  type PlaylistSensStats,
} from "../src/lib/sens-analytics.ts";
import type { Playlist, Task } from "../src/lib/types.ts";
import { getDisplaySens, getRecommendedSens } from "../src/lib/viscose.ts";

describe("sens-analytics", () => {
  describe("valorantToCm360 and in-game conversions", () => {
    it("converts Valorant sensitivity to cm/360 at 800 DPI", () => {
      const cm68 = valorantToCm360(0.24013, 800);
      assert.ok(Math.abs(cm68 - 68.0) < 0.1, `Expected ~68.0, got ${cm68}`);

      const cm50 = valorantToCm360(0.32676, 800);
      assert.ok(Math.abs(cm50 - 50.0) < 0.1, `Expected ~50.0, got ${cm50}`);
    });

    it("converts Valorant sensitivity to cm/360 at 1600 DPI", () => {
      const cm34 = valorantToCm360(0.24013, 1600);
      assert.ok(Math.abs(cm34 - 34.0) < 0.1, `Expected ~34.0, got ${cm34}`);
    });

    it("converts cm/360 back to Valorant sensitivity at 800 and 1600 DPI", () => {
      const val800 = cm360ToValorant(68.0, 800);
      assert.ok(Math.abs(val800 - 0.24) < 0.01, `Expected ~0.24, got ${val800}`);

      const val1600 = cm360ToValorant(34.0, 1600);
      assert.ok(Math.abs(val1600 - 0.24) < 0.01, `Expected ~0.24, got ${val1600}`);
    });

    it("converts cm/360 to Source sensitivity at 800 and 1600 DPI", () => {
      // yaw = 0.022. 914.4 / (0.022 * 800 * 50) = 914.4 / 880 = 1.039
      const src800 = cm360ToSource(50.0, 800);
      assert.ok(Math.abs(src800 - 1.039) < 0.01, `Expected ~1.039, got ${src800}`);

      const src1600 = cm360ToSource(50.0, 1600);
      assert.ok(Math.abs(src1600 - 0.52) < 0.01, `Expected ~0.52, got ${src1600}`);
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

      // Best entry should be 67.0 cm on lattice
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.sens, 67.0);
      assert.equal(analysis.bestBucket.rangeLabel, "67 cm");
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
        // 68 cm: 5 runs, high scores, high consistency (snaps to 67.0 cm on lattice)
        { sens: 68.0, score: 98 },
        { sens: 68.0, score: 99 },
        { sens: 68.0, score: 97 },
        { sens: 68.0, score: 98.5 },
        { sens: 68.0, score: 97.5 },
        // 50 cm: 1 lucky run with 100 score (snaps to 50.0 cm on lattice)
        { sens: 50.0, score: 100 },
      ];

      const analysis = computeSweetSpotAnalytics(runs);
      assert.ok(analysis !== null);
      assert.equal(analysis.totalRuns, 6);

      // Best bucket should be 67.0 cm due to sample qualification and Bayesian shrinkage
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.sens, 67.0);
      assert.equal(analysis.bestBucket.rangeLabel, "67 cm");
      assert.equal(analysis.bestBucket.count, 5);
      assert.ok(analysis.bestBucket.stdDev !== null && analysis.bestBucket.stdDev < 2);
      assert.ok(analysis.bestBucket.confidenceLevel === "medium");

      // Single-run specific sensitivity should have insufficient confidence
      const single = analysis.buckets.find((b) => Math.abs(b.sens - 50.0) < 0.1);
      assert.ok(single !== undefined);
      assert.equal(single.count, 1);
      assert.equal(single.stdDev, null);
      assert.equal(single.consistency, null);
      assert.equal(single.confidenceLevel, "insufficient");
    });

    it("allows single-run sensitivities to be fully eligible and selected as bestBucket when minEligibleRuns: 1 is passed", () => {
      // 52 cm had 3 older plays with score 80
      // 38.4 cm had 1 randomized play with score 120 (clearly superior score, snaps to 39.18 cm)
      const runs = [
        { sens: 52.0, score: 80 },
        { sens: 52.0, score: 80 },
        { sens: 52.0, score: 80 },
        { sens: 38.4, score: 120 },
      ];

      const analysis = computeSweetSpotAnalytics(runs, { minEligibleRuns: 1, binPriorStrength: 1 });
      assert.ok(analysis !== null);
      assert.equal(analysis.totalRuns, 4);

      // 39.18 cm should NOT be discarded despite having only 1 run
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.sens, 39.18);
      assert.equal(analysis.bestBucket.count, 1);
      assert.equal(analysis.bestBucket.rangeLabel, "39.2 cm");
      assert.equal(analysis.minEligibleRuns, 1);
    });

    it("groups decimal sensitivities into ~5% exponential lattice bins", () => {
      const runs = [
        { sens: 41.2, score: 100 },
        { sens: 41.3, score: 102 },
        { sens: 41.4, score: 105 },
        { sens: 52.0, score: 90 },
      ];

      const analysis = computeSweetSpotAnalytics(runs, { minEligibleRuns: 1 });
      assert.ok(analysis !== null);
      // 41.2, 41.3, 41.4 merge into k=-4 (41.14 cm), 52.0 is k=1 (52.5 cm)
      assert.equal(analysis.buckets.length, 2);
      const sensValues = analysis.buckets.map((b) => b.sens).sort((a, b) => a - b);
      assert.deepEqual(sensValues, [41.14, 52.5]);
    });
  });

  describe("predictOptimalSensitivity", () => {
    it("returns null when runs array is empty", () => {
      assert.equal(predictOptimalSensitivity([]), null);
    });

    it("predicts optimal sensitivity combining parabolic apex and empirical sweet spot", () => {
      // Create a quadratic curve peaking around 60 cm (>= 12 points for robust quadratic log fit)
      const runs = [
        { sens: 40.0, score: 600 },
        { sens: 45.0, score: 775 },
        { sens: 48.0, score: 860 },
        { sens: 50.0, score: 900 },
        { sens: 55.0, score: 975 },
        { sens: 60.0, score: 1000 },
        { sens: 60.0, score: 990 },
        { sens: 65.0, score: 975 },
        { sens: 70.0, score: 900 },
        { sens: 72.0, score: 860 },
        { sens: 75.0, score: 775 },
        { sens: 80.0, score: 600 },
      ];

      const prediction = predictOptimalSensitivity(runs);
      assert.ok(prediction !== null);
      assert.ok(typeof prediction.predictedSens === "number");
      // The predicted sensitivity should be close to 60 cm
      assert.ok(Math.abs(prediction.predictedSens - 60.0) <= 2.5);
      assert.ok(prediction.label.includes("cm"));
      assert.ok(prediction.confidence === "low" || prediction.confidence === "medium");
      assert.ok(prediction.vertexSens !== null && Math.abs(prediction.vertexSens - 60.0) <= 2.5);
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
      // Empirical best is ~81.4 cm on lattice
      assert.ok(Math.abs(prediction.empiricalSens - 81.44) < 1.0);
      assert.ok(Math.abs(prediction.predictedSens - 81.44) < 5.0);
    });

    it("applies theoretical weight pulling towards quadratic vertex when valid", () => {
      // Curve with vertex at ~70 cm, but empirical center at 50 cm
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
        { sens: 45, score: 850 },
        { sens: 65, score: 975 },
      ];

      const predNeutral = predictOptimalSensitivity(runs, "neutro");
      const predTheoretical = predictOptimalSensitivity(runs, "teorico");

      assert.ok(predNeutral && predTheoretical);
      assert.equal(predNeutral.profile, "neutro");
      assert.equal(predTheoretical.profile, "teorico");
      assert.ok(
        predTheoretical.predictedSens >= predNeutral.predictedSens,
        `Theoretical (${predTheoretical.predictedSens}) should be >= Neutral (${predNeutral.predictedSens})`
      );
    });

    it("penalizes variance in consistencia profile compared to neutro", () => {
      // Bin A (~41.14 cm): mean 1000, high variance (scores: 900, 1100, 900, 1100)
      // Bin B (~50.0 cm): mean 970, zero variance (scores: 970, 970, 970, 970)
      const runs = [
        { sens: 41.14, score: 900 },
        { sens: 41.14, score: 1100 },
        { sens: 41.14, score: 900 },
        { sens: 41.14, score: 1100 },
        { sens: 50.0, score: 970 },
        { sens: 50.0, score: 970 },
        { sens: 50.0, score: 970 },
        { sens: 50.0, score: 970 },
      ];
      const neutral = predictOptimalSensitivity(runs, "neutro");
      const consistency = predictOptimalSensitivity(runs, "consistencia");
      assert.ok(neutral && consistency);
      // Neutro (lambda=0) escolhe a maior média (41.14)
      assert.equal(neutral.empiricalSens, 41.14);
      // Consistencia (lambda=1.0) penaliza a variância alta de 41.14 e escolhe a estável 50.0
      assert.equal(consistency.empiricalSens, 50.0);
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
        { sens: 40.0, score: 105 },
        { sens: 40.0, score: 105 },
        { sens: 42.0, score: 95 },
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
      assert.ok(Math.abs(localOnly.predictedSens - 39.18) < 0.1);
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
      assert.equal(blended.confidence, "medium");
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

  describe("computePlaylistSensStats", () => {
    it("handles empty playlist or playlist without matching tasks", () => {
      const emptyPlaylist: Playlist = {
        id: "pl-empty",
        name: "Empty Playlist",
        items: [],
        createdAt: "2026-10-01T00:00:00.000Z",
      };

      const stats = computePlaylistSensStats(emptyPlaylist, []);
      assert.equal(stats.playlistId, "pl-empty");
      assert.equal(stats.playlistName, "Empty Playlist");
      assert.equal(stats.scenariosCount, 0);
      assert.equal(stats.totalRuns, 0);
      assert.deepEqual(stats.categorySlices, []);
      assert.deepEqual(stats.normalizedRuns, []);
      assert.equal(stats.overallConfidence, "insufficient");
      assert.equal(stats.displaySens.source, "viscose");
      assert.equal(stats.displaySens.value, 45);

      const playlistWithMissingTasks: Playlist = {
        id: "pl-missing",
        name: "Missing Tasks Playlist",
        items: [
          { id: "item-1", taskId: "non-existent-1", targetMode: "reps", targetValue: 3 },
          { id: "item-2", taskId: "non-existent-2", targetMode: "time", targetValue: 60 },
        ],
        createdAt: "2026-10-01T00:00:00.000Z",
      };

      const statsMissing = computePlaylistSensStats(playlistWithMissingTasks, []);
      assert.equal(statsMissing.scenariosCount, 0);
      assert.equal(statsMissing.totalRuns, 0);
      assert.deepEqual(statsMissing.categorySlices, []);
      assert.equal(statsMissing.displaySens.source, "viscose");
    });

    it("predicts optimal sensitivity when playlist has sufficient normalized runs across sensitivities", () => {
      const task1: Task = {
        id: "t1",
        name: "1w4t precision",
        category: "Click Timing",
        subcategory: "Precision",
        sessions: [
          { id: "s1-1", date: "2026-09-01", sens: 40, pb: 70, threshold: 0 },
          { id: "s1-2", date: "2026-09-02", sens: 45, pb: 85, threshold: 0 },
          { id: "s1-3", date: "2026-09-03", sens: 50, pb: 95, threshold: 0 },
          { id: "s1-4", date: "2026-09-04", sens: 55, pb: 100, threshold: 0 }, // PB = 100
          { id: "s1-5", date: "2026-09-05", sens: 60, pb: 98, threshold: 0 },
          { id: "s1-6", date: "2026-09-06", sens: 65, pb: 85, threshold: 0 },
          { id: "s1-7", date: "2026-09-07", sens: 70, pb: 70, threshold: 0 },
          { id: "s1-8", date: "2026-09-08", sens: 75, pb: 60, threshold: 0 },
        ],
      };

      const task2: Task = {
        id: "t2",
        name: "pasu stability",
        category: "Click Timing",
        subcategory: "Stability",
        sessions: [
          { id: "s2-1", date: "2026-09-01", sens: 40, pb: 700, threshold: 0 },
          { id: "s2-2", date: "2026-09-02", sens: 45, pb: 850, threshold: 0 },
          { id: "s2-3", date: "2026-09-03", sens: 50, pb: 950, threshold: 0 },
          { id: "s2-4", date: "2026-09-04", sens: 55, pb: 1000, threshold: 0 }, // PB = 1000
          { id: "s2-5", date: "2026-09-05", sens: 60, pb: 990, threshold: 0 },
          { id: "s2-6", date: "2026-09-06", sens: 65, pb: 860, threshold: 0 },
          { id: "s2-7", date: "2026-09-07", sens: 70, pb: 710, threshold: 0 },
          { id: "s2-8", date: "2026-09-08", sens: 75, pb: 610, threshold: 0 },
        ],
      };

      const playlist: Playlist = {
        id: "pl-sufficient",
        name: "Click Timing Routine",
        items: [
          { id: "i1", taskId: "t1", targetMode: "reps", targetValue: 5 },
          { id: "i2", taskId: "t2", targetMode: "reps", targetValue: 5 },
        ],
        createdAt: "2026-09-01T00:00:00.000Z",
      };

      const stats = computePlaylistSensStats(playlist, [task1, task2]);
      assert.equal(stats.scenariosCount, 2);
      assert.equal(stats.totalRuns, 16);
      assert.equal(stats.normalizedRuns.length, 16);

      // Verify normalization: normalized scores are relative to moving median baseline (~100 baseline)
      const maxScoreT1 = Math.max(...stats.normalizedRuns.filter((r) => r.scenario === "1w4t precision").map((r) => r.score));
      assert.ok(maxScoreT1 > 110 && maxScoreT1 < 125, `Expected T1 peak relative score ~118, got ${maxScoreT1}`);
      const maxScoreT2 = Math.max(...stats.normalizedRuns.filter((r) => r.scenario === "pasu stability").map((r) => r.score));
      assert.ok(maxScoreT2 > 110 && maxScoreT2 < 125, `Expected T2 peak relative score ~117, got ${maxScoreT2}`);
      // Cross-scale consistency: despite 1w4t being ~100 and pasu being ~1000, relative peaks match within 1%
      assert.ok(Math.abs(maxScoreT1 - maxScoreT2) < 1.0);

      // Slices should exist
      assert.equal(stats.categorySlices.length, 2);

      // Overall prediction should be calculated from data points
      assert.equal(stats.displaySens.source, "predicted");
      assert.ok(stats.overallConfidence === "medium" || stats.overallConfidence === "high");
      assert.ok(
        Math.abs(stats.displaySens.value - 55.0) <= 5.0,
        `Expected predicted sens near 55 cm, got ${stats.displaySens.value}`
      );
    });

    it("falls back to weighted Viscose recommendations when runs are insufficient", () => {
      const task1: Task = {
        id: "t1",
        name: "1w6t",
        category: "Click Timing",
        subcategory: "Precision", // Viscose recommendation: 60 cm
        sessions: [
          { id: "s1", date: "2026-09-10", sens: 50, pb: 100, threshold: 0 },
          { id: "s2", date: "2026-09-11", sens: 55, pb: 105, threshold: 0 },
        ],
      };

      const task2: Task = {
        id: "t2",
        name: "speed flick",
        category: "Flick Tech",
        subcategory: "Speed", // Viscose recommendation: 45 cm
        sessions: [
          { id: "s3", date: "2026-09-10", sens: 45, pb: 80, threshold: 0 },
        ],
      };

      const playlist: Playlist = {
        id: "pl-insufficient",
        name: "Mixed Warmup",
        items: [
          { id: "i1", taskId: "t1", targetMode: "reps", targetValue: 3 },
          { id: "i2", taskId: "t2", targetMode: "reps", targetValue: 3 },
        ],
        createdAt: "2026-09-10T00:00:00.000Z",
      };

      const stats = computePlaylistSensStats(playlist, [task1, task2]);
      assert.equal(stats.scenariosCount, 2);
      assert.equal(stats.totalRuns, 3);
      assert.equal(stats.displaySens.source, "viscose");
      assert.equal(stats.overallConfidence, "insufficient");

      // Weighted average: (60 * 2 runs + 45 * 1 run) / 3 runs = 165 / 3 = 55 cm
      assert.equal(stats.displaySens.value, 55);
    });

    it("correctly builds, groups, and sorts category slices", () => {
      const taskA: Task = {
        id: "ta",
        name: "Microshot",
        category: "Flick Tech",
        subcategory: "Micro", // Viscose = 65
        sessions: [
          { id: "sa1", date: "2026-09-01", sens: 65, pb: 100, threshold: 0 },
          { id: "sa2", date: "2026-09-02", sens: 65, pb: 105, threshold: 0 },
        ],
      };

      const taskB: Task = {
        id: "tb",
        name: "Air Wrist",
        category: "Control Tracking",
        subcategory: "Wrist", // Viscose = 44
        sessions: Array.from({ length: 10 }, (_, i) => ({
          id: `sb${i}`,
          date: `2026-09-${i + 1}`,
          sens: 40 + (i % 5),
          pb: 500 + i * 10,
          threshold: 0,
        })),
      };

      const taskC: Task = {
        id: "tc",
        name: "Flick Speed",
        category: "Flick Tech",
        subcategory: "Speed", // Viscose = 45
        sessions: [
          { id: "sc1", date: "2026-09-01", sens: 45, pb: 80, threshold: 0 },
        ],
      };

      const playlist: Playlist = {
        id: "pl-sort",
        name: "Benchmark Routine",
        items: [
          { id: "i1", taskId: "ta", targetMode: "reps", targetValue: 3 },
          { id: "i2", taskId: "tb", targetMode: "reps", targetValue: 3 },
          { id: "i3", taskId: "tc", targetMode: "reps", targetValue: 3 },
        ],
        createdAt: "2026-09-01T00:00:00.000Z",
      };

      const stats = computePlaylistSensStats(playlist, [taskA, taskB, taskC]);
      assert.equal(stats.categorySlices.length, 3);

      // Sorted by totalRuns descending:
      // Slice 0: Control Tracking / Wrist (10 runs)
      // Slice 1: Flick Tech / Micro (2 runs)
      // Slice 2: Flick Tech / Speed (1 run)
      assert.equal(stats.categorySlices[0].category, "Control Tracking");
      assert.equal(stats.categorySlices[0].subcategory, "Wrist");
      assert.equal(stats.categorySlices[0].totalRuns, 10);
      assert.equal(stats.categorySlices[0].scenariosCount, 1);

      assert.equal(stats.categorySlices[1].category, "Flick Tech");
      assert.equal(stats.categorySlices[1].subcategory, "Micro");
      assert.equal(stats.categorySlices[1].totalRuns, 2);
      assert.equal(stats.categorySlices[1].scenariosCount, 1);

      assert.equal(stats.categorySlices[2].category, "Flick Tech");
      assert.equal(stats.categorySlices[2].subcategory, "Speed");
      assert.equal(stats.categorySlices[2].totalRuns, 1);
      assert.equal(stats.categorySlices[2].scenariosCount, 1);
    });
  });

  describe("Tasks 2 & 3: Multi-scope Sensitivity & Playlist Analytics Components", () => {
    it("verifies i18n keys and parity for playlist and category sensitivity", () => {
      const i18nContent = fs.readFileSync(path.resolve("src/lib/i18n.tsx"), "utf-8");

      const expectedKeys = [
        "randomizer.scopePlaylist",
        "randomizer.scopeCategory",
        "randomizer.selectPlaylist",
        "randomizer.selectCategory",
        "randomizer.noPlaylistsAvailable",
        "randomizer.noCategoriesAvailable",
        "categorySens.viewInChart",
        "playlistSens.title",
        "playlistSens.subtitle",
        "playlistSens.colPlaylist",
        "playlistSens.colRecommended",
        "playlistSens.colComposition",
        "playlistSens.colStats",
        "playlistSens.colConfidence",
        "playlistSens.colActions",
        "playlistSens.viewInChart",
        "playlistSens.applySens",
        "playlistSens.empty",
        "playlistSens.sourcePredicted",
        "playlistSens.sourceViscose",
        "playlistSens.scenariosRuns",
      ];

      for (const key of expectedKeys) {
        const occurrences = (i18nContent.match(new RegExp(`"${key.replace(".", "\\.")}":`, "g")) || []).length;
        assert.equal(
          occurrences,
          2,
          `Expected key ${key} to appear exactly twice (in pt and en dicts), found ${occurrences}`
        );
      }
    });

    it("verifies zero emojis across newly modified/created component files", () => {
      const emojiRegex = /\p{Extended_Pictographic}/u;

      const filesToCheck = [
        "src/lib/i18n.tsx",
        "src/lib/sens-analytics.ts",
        "src/components/playlist/PlaylistSensCard.tsx",
        "src/components/randomizer/SensRandomizerChart.tsx",
        "src/components/SensRandomizerView.tsx",
        "src/components/CategorySensCard.tsx",
        "src/App.tsx",
      ];

      for (const relPath of filesToCheck) {
        const content = fs.readFileSync(path.resolve(relPath), "utf-8");
        assert.equal(
          emojiRegex.test(content),
          false,
          `File ${relPath} contains visual emojis, which is strictly prohibited`
        );
      }
    });

    it("verifies SensRandomizerChart and PlaylistSensCard component source integrity", () => {
      const chartCode = fs.readFileSync(path.resolve("src/components/randomizer/SensRandomizerChart.tsx"), "utf-8");
      const cardCode = fs.readFileSync(path.resolve("src/components/playlist/PlaylistSensCard.tsx"), "utf-8");
      const viewCode = fs.readFileSync(path.resolve("src/components/SensRandomizerView.tsx"), "utf-8");

      // Verify scope modes in chart
      assert.ok(chartCode.includes('"current"'));
      assert.ok(chartCode.includes('"playlist"'));
      assert.ok(chartCode.includes('"category"'));
      assert.ok(chartCode.includes('"all"'));

      // Verify PlaylistSensCard computes stats and contains action buttons
      assert.ok(cardCode.includes("computePlaylistSensStats"));
      assert.ok(cardCode.includes("onViewInChart"));
      assert.ok(cardCode.includes("onApplySens"));

      // Verify SensRandomizerView integrates PlaylistSensCard and passes callbacks
      assert.ok(viewCode.includes("<PlaylistSensCard"));
      assert.ok(viewCode.includes("handleViewPlaylistInChart"));
      assert.ok(viewCode.includes("handleViewCategoryInChart"));
    });
  });

  describe("Tasks 4 & 5: Playlist Runner Sensitivity Integration and Quick Apply", () => {
    it("verifies i18n keys for playlist and runner sensitivity in pt and en", () => {
      const i18nContent = fs.readFileSync(path.resolve("src/lib/i18n.tsx"), "utf-8");

      const expectedKeys = [
        "playlist.recommendedSens",
        "playlist.applySens",
        "playlist.appliedSuccess",
        "runner.scenarioSens",
        "runner.playlistSens",
        "runner.applySens",
      ];

      for (const key of expectedKeys) {
        const occurrences = (i18nContent.match(new RegExp(`"${key.replace(".", "\\.")}":`, "g")) || []).length;
        assert.equal(
          occurrences,
          2,
          `Expected key ${key} to appear exactly twice (in pt and en dicts), found ${occurrences}`
        );
      }
    });

    it("verifies zero emojis across playlist runner components and App.tsx", () => {
      const emojiRegex = /\p{Extended_Pictographic}/u;

      const filesToCheck = [
        "src/components/playlist/PlaylistRunnerView.tsx",
        "src/components/playlist/DashboardPlaylistRunner.tsx",
        "src/App.tsx",
      ];

      for (const relPath of filesToCheck) {
        const content = fs.readFileSync(path.resolve(relPath), "utf-8");
        assert.equal(
          emojiRegex.test(content),
          false,
          `File ${relPath} contains visual emojis, which is strictly prohibited`
        );
      }
    });

    it("verifies PlaylistRunnerView and DashboardPlaylistRunner source integration", () => {
      const runnerCode = fs.readFileSync(path.resolve("src/components/playlist/PlaylistRunnerView.tsx"), "utf-8");
      const dashCode = fs.readFileSync(path.resolve("src/components/playlist/DashboardPlaylistRunner.tsx"), "utf-8");
      const appCode = fs.readFileSync(path.resolve("src/App.tsx"), "utf-8");

      // Verify PlaylistRunnerView computes playlist sens stats and accepts onApplySens
      assert.ok(runnerCode.includes("computePlaylistSensStats"));
      assert.ok(runnerCode.includes("onApplySens"));
      assert.ok(runnerCode.includes("playlist.recommendedSens"));
      assert.ok(runnerCode.includes("runner.scenarioSens"));
      assert.ok(runnerCode.includes("runner.playlistSens"));

      // Verify DashboardPlaylistRunner displays recommended sens
      assert.ok(dashCode.includes("getRecommendedSens"));

      // Verify App.tsx defines handleApplySens and passes to PlaylistRunnerView
      assert.ok(appCode.includes("handleApplySens"));
      assert.ok(appCode.includes("onApplySens={handleApplySens}"));
    });
  });

  describe("getScenarioIdealSens", () => {
    it("falls back to Viscose benchmark when task is null or has no sessions", () => {
      const nullRes = getScenarioIdealSens(null);
      assert.equal(nullRes.source, "viscose");
      assert.equal(nullRes.value, 60); // Default Click Timing / Precision
      assert.equal(nullRes.confidence, "insufficient");

      const emptyTask: Task = {
        id: "t1",
        name: "VT Pasu Small",
        category: "Click Timing",
        subcategory: "Reading",
        sessions: [],
      };
      const emptyRes = getScenarioIdealSens(emptyTask);
      assert.equal(emptyRes.source, "viscose");
      assert.equal(emptyRes.value, 45); // Viscose Click Timing / Reading
      assert.equal(emptyRes.confidence, "insufficient");
      assert.equal(emptyRes.count, 0);
    });

    it("falls back to Viscose benchmark when runs are insufficient (< 3 runs)", () => {
      const task: Task = {
        id: "t2",
        name: "VT Smoothbot",
        category: "Control Tracking",
        subcategory: "Arm",
        sessions: [
          { date: "2026-10-01", pb: 120, threshold: 100, sens: 34 },
          { date: "2026-10-02", pb: 125, threshold: 100, sens: 34 },
        ],
      };
      const res = getScenarioIdealSens(task);
      assert.equal(res.source, "viscose");
      assert.equal(res.value, 34); // Viscose Control Tracking / Arm
      assert.equal(res.count, 2);
    });

    it("returns empirical sweet spot when task has medium/high confidence (>= 15 runs across >= 5 bins)", () => {
      const task: Task = {
        id: "t3",
        name: "VT Multiclick",
        category: "Flick Tech",
        subcategory: "Speed",
        sessions: [
          { date: "2026-10-01", pb: 100, threshold: 80, sens: 35.5 },
          { date: "2026-10-02", pb: 105, threshold: 80, sens: 35.5 },
          { date: "2026-10-03", pb: 130, threshold: 80, sens: 39.2 },
          { date: "2026-10-04", pb: 135, threshold: 80, sens: 39.2 },
          { date: "2026-10-05", pb: 160, threshold: 80, sens: 43.2 },
          { date: "2026-10-06", pb: 162, threshold: 80, sens: 43.2 },
          { date: "2026-10-07", pb: 161, threshold: 80, sens: 43.2 },
          { date: "2026-10-08", pb: 159, threshold: 80, sens: 43.2 },
          { date: "2026-10-09", pb: 163, threshold: 80, sens: 43.2 },
          { date: "2026-10-10", pb: 132, threshold: 80, sens: 47.6 },
          { date: "2026-10-11", pb: 130, threshold: 80, sens: 47.6 },
          { date: "2026-10-12", pb: 110, threshold: 80, sens: 52.5 },
          { date: "2026-10-13", pb: 108, threshold: 80, sens: 52.5 },
          { date: "2026-10-14", pb: 109, threshold: 80, sens: 52.5 },
          { date: "2026-10-15", pb: 107, threshold: 80, sens: 52.5 },
        ],
      };
      const res = getScenarioIdealSens(task, undefined, 800);
      assert.equal(res.source, "empirical");
      assert.ok(Math.abs(res.value - 43.2) < 1.0);
      assert.equal(res.viscoseSens, 45);
      assert.equal(res.count, 15);
      assert.ok(res.empiricalSens !== null);
    });

    it("inherits category group prediction when scenario is insufficient but category has >= 15 runs", () => {
      const targetTask: Task = {
        id: "t4_target",
        name: "VT Air Angel",
        category: "Reactive Tracking",
        subcategory: "Control",
        sessions: [
          { date: "2026-10-01", pb: 80, threshold: 70, sens: 30 },
        ],
      };

      const siblingTask: Task = {
        id: "t4_sibling",
        name: "VT Air Voltaic",
        category: "Reactive Tracking",
        subcategory: "Control",
        sessions: [
          { date: "2026-10-01", pb: 100, threshold: 90, sens: 30 },
          { date: "2026-10-02", pb: 102, threshold: 90, sens: 30 },
          { date: "2026-10-03", pb: 120, threshold: 90, sens: 33 },
          { date: "2026-10-04", pb: 122, threshold: 90, sens: 33 },
          { date: "2026-10-05", pb: 150, threshold: 90, sens: 36.5 },
          { date: "2026-10-06", pb: 152, threshold: 90, sens: 36.5 },
          { date: "2026-10-07", pb: 155, threshold: 90, sens: 36.5 },
          { date: "2026-10-08", pb: 153, threshold: 90, sens: 36.5 },
          { date: "2026-10-09", pb: 154, threshold: 90, sens: 36.5 },
          { date: "2026-10-10", pb: 125, threshold: 90, sens: 40 },
          { date: "2026-10-11", pb: 123, threshold: 90, sens: 40 },
          { date: "2026-10-12", pb: 105, threshold: 90, sens: 44 },
          { date: "2026-10-13", pb: 104, threshold: 90, sens: 44 },
          { date: "2026-10-14", pb: 103, threshold: 90, sens: 44 },
          { date: "2026-10-15", pb: 102, threshold: 90, sens: 44 },
        ],
      };

      const res = getScenarioIdealSens(targetTask, [targetTask, siblingTask], 800);
      assert.equal(res.source, "empirical");
      assert.ok(Math.abs(res.value - 36.5) < 1.0);
      assert.equal(res.viscoseSens, 34);
    });
  });

  describe("suggestRecenter", () => {
    it("suggests recenter when confidence is medium or high and drift exceeds 8%", () => {
      const highConfidencePred: any = {
        predictedSens: 55.0,
        confidence: "medium",
      };
      // drift |ln(55 / 50)| = ln(1.10) > ln(1.08)
      const suggestion = suggestRecenter(highConfidencePred, 50.0);
      assert.ok(suggestion !== null);
      assert.equal(suggestion.suggestedCm, 55.0);
      assert.equal(suggestion.currentCm, 50.0);
      assert.ok(suggestion.ratio > 1.08);
    });

    it("does not suggest recenter when drift is <= 8%", () => {
      const pred: any = {
        predictedSens: 51.0,
        confidence: "high",
      };
      // drift |ln(51 / 50)| = ln(1.02) < ln(1.08)
      const suggestion = suggestRecenter(pred, 50.0);
      assert.equal(suggestion, null);
    });

    it("does not suggest recenter when confidence is low or insufficient", () => {
      const lowPred: any = {
        predictedSens: 60.0,
        confidence: "low",
      };
      const insufficientPred: any = {
        predictedSens: 60.0,
        confidence: "insufficient",
      };
      assert.equal(suggestRecenter(lowPred, 50.0), null);
      assert.equal(suggestRecenter(insufficientPred, 50.0), null);
    });
  });

  describe("multi-scale category pooling", () => {
    it("pooling scenarios with vastly different raw score scales preserves optimal peak", () => {
      // Task A: raw scores ~100, peak at 50 cm
      // Task B: raw scores ~100,000, peak at 50 cm
      const runsA: RunDataPoint[] = [
        { sens: 41.14, score: 0.8 },
        { sens: 45.35, score: 0.9 },
        { sens: 50.0, score: 1.0 },
        { sens: 50.0, score: 1.0 },
        { sens: 55.13, score: 0.9 },
        { sens: 60.77, score: 0.8 },
      ];
      const runsB: RunDataPoint[] = [
        { sens: 41.14, score: 0.8 },
        { sens: 45.35, score: 0.9 },
        { sens: 50.0, score: 1.0 },
        { sens: 50.0, score: 1.0 },
        { sens: 55.13, score: 0.9 },
        { sens: 60.77, score: 0.8 },
      ];

      const pooled = [...runsA, ...runsB];
      const pred = predictOptimalSensitivity(pooled, "equilibrado");
      assert.ok(pred !== null);
      assert.equal(pred.predictedSens, 50.0);
    });
  });
});


