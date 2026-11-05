import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DIRECTIONS,
  defaultDirection,
  directedCenterCm,
  directedRange,
  directionKey,
  directionSign,
  resolveDirection,
} from "../src/lib/randomizer-directions.ts";
import { VISCOSE_CATEGORIES } from "../src/lib/viscose.ts";

describe("randomizer-directions", () => {
  it("default table covers every Viscose category/subcategory", () => {
    for (const [cat, subs] of Object.entries(VISCOSE_CATEGORIES)) {
      for (const sub of subs) {
        assert.ok(DEFAULT_DIRECTIONS[cat]?.[sub], `faltando ${cat}/${sub}`);
      }
    }
  });

  it("default directions match the plan table", () => {
    assert.equal(defaultDirection("Flick Tech", "Speed"), "slow");
    assert.equal(defaultDirection("Flick Tech", "Micro"), "fast");
    assert.equal(defaultDirection("Click Timing", "Precision"), "fast");
    assert.equal(defaultDirection("Control Tracking", "Arm"), "slow");
    assert.equal(defaultDirection("Control Tracking", "Wrist"), "fast");
    assert.equal(defaultDirection("Reactive Tracking", "Speed"), "slow");
    assert.equal(defaultDirection("Reactive Tracking", "Control"), "neutral");
  });

  it("unknown combinations fall back to neutral", () => {
    assert.equal(defaultDirection("Custom", "Thing"), "neutral");
  });

  it("override wins over the default; missing override uses default", () => {
    const overrides = { [directionKey("Flick Tech", "Speed")]: "fast" as const };
    assert.equal(resolveDirection(overrides, "Flick Tech", "Speed"), "fast");
    assert.equal(resolveDirection(overrides, "Flick Tech", "Micro"), "fast");
    assert.equal(resolveDirection(undefined, "Flick Tech", "Speed"), "slow");
    assert.equal(resolveDirection({}, "Flick Tech", "Speed"), "slow");
  });

  it("directionKey uses Categoria/Subcategoria", () => {
    assert.equal(directionKey("Control Tracking", "Arm"), "Control Tracking/Arm");
  });

  it("sign: slow +1, fast -1, neutral 0", () => {
    assert.equal(directionSign("slow"), 1);
    assert.equal(directionSign("fast"), -1);
    assert.equal(directionSign("neutral"), 0);
  });

  it("directed slow shifts the center up by +0.6p", () => {
    // c = 40, p = 0.25 -> c' = 40 * (1 + 0.6 * 0.25) = 46
    assert.ok(Math.abs(directedCenterCm(40, 0.25, "slow") - 46) < 1e-9);
    const r = directedRange(40, 0.25, "slow");
    assert.ok(Math.abs(r.loCm - 46 * 0.75) < 1e-9);
    assert.ok(Math.abs(r.hiCm - 46 * 1.25) < 1e-9);
  });

  it("directed fast shifts the center down and neutral keeps it", () => {
    assert.ok(Math.abs(directedCenterCm(40, 0.25, "fast") - 34) < 1e-9);
    assert.equal(directedCenterCm(40, 0.25, "neutral"), 40);
  });
});
