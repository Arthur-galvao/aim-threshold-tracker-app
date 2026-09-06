import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  valorantToCm360,
  formatSensitivity,
  calculateParabolicTrendline,
  computeSweetSpotAnalytics,
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

    it("applies Bayesian shrinkage and sample variance correctly", () => {
      const runs = [
        // Bucket 35-40: 5 runs, high scores, high consistency
        { sens: 37, score: 98 },
        { sens: 38, score: 99 },
        { sens: 36, score: 97 },
        { sens: 37.5, score: 98.5 },
        { sens: 39, score: 97.5 },
        // Bucket 50-55: 1 lucky run with 100 score
        { sens: 52, score: 100 },
      ];

      const analysis = computeSweetSpotAnalytics(runs);
      assert.ok(analysis !== null);
      assert.equal(analysis.totalRuns, 6);

      // Best bucket should be 35-40 due to sample qualification and Bayesian shrinkage,
      // NOT the single-run bucket 50-55
      assert.ok(analysis.bestBucket !== null);
      assert.equal(analysis.bestBucket.min, 35);
      assert.equal(analysis.bestBucket.count, 5);
      assert.ok(analysis.bestBucket.stdDev !== null && analysis.bestBucket.stdDev < 2);
      assert.ok(analysis.bestBucket.confidenceLevel === "medium");

      // The single-run bucket should have null stdDev and insufficient confidence
      const singleBucket = analysis.buckets.find((b) => b.min === 50);
      assert.ok(singleBucket !== undefined);
      assert.equal(singleBucket.count, 1);
      assert.equal(singleBucket.stdDev, null);
      assert.equal(singleBucket.consistency, null);
      assert.equal(singleBucket.confidenceLevel, "insufficient");
    });
  });
});
