import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  valorantToCm360,
  formatSensitivity,
  calculateParabolicTrendline,
  computeSweetSpotAnalytics,
  predictOptimalSensitivity,
  PREDICTOR_PROFILES,
} from "../src/lib/sens-analytics.ts";

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
});
