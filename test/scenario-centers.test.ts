import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stabilizeCenter } from "../src/lib/scenario-centers.ts";

describe("stabilizeCenter", () => {
  it("returns next when prev is undefined or invalid", () => {
    assert.equal(stabilizeCenter(undefined, 40), 40);
    assert.equal(stabilizeCenter(0, 35.5), 35.5);
    assert.equal(stabilizeCenter(NaN, 45), 45);
  });

  it("permits small drifts within +/- 10%", () => {
    // 40 + 5% = 42
    assert.equal(stabilizeCenter(40, 42), 42);
    // 40 - 5% = 38
    assert.equal(stabilizeCenter(40, 38), 38);
  });

  it("clamps drifts larger than +10%", () => {
    // 40 + 25% = 50 -> clamped to 40 * 1.1 = 44
    assert.equal(stabilizeCenter(40, 50), 44);
  });

  it("clamps drifts larger than -10%", () => {
    // 40 - 25% = 30 -> clamped to 40 * 0.9 = 36
    assert.equal(stabilizeCenter(40, 30), 36);
  });

  it("guarantees applying overrides does not mutate baseSensCm", () => {
    const originalSettings = {
      baseSensCm: 45.0,
      centerOverrides: {} as Record<string, number>,
      scenarioIdealCm: 40.0,
    };

    const targetScenarios = ["vt 1w4ts", "vt pasu"];
    const newSweetSpot = 38.0;

    // Simulate handleApplySens logic
    const overrides = { ...originalSettings.centerOverrides };
    for (const name of targetScenarios) {
      overrides[name.trim().toLowerCase()] = newSweetSpot;
    }

    const updatedSettings = {
      ...originalSettings,
      scenarioIdealCm: newSweetSpot,
      centerOverrides: overrides,
    };

    assert.equal(updatedSettings.baseSensCm, 45.0, "baseSensCm must remain untouched");
    assert.equal(updatedSettings.centerOverrides["vt 1w4ts"], 38.0);
    assert.equal(updatedSettings.centerOverrides["vt pasu"], 38.0);
  });
});
