import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSensSummary } from "../src/lib/chart-format.ts";

describe("formatSensSummary", () => {
  it("lists up to 3 distinct sens, sorted and deduplicated", () => {
    assert.deepEqual(formatSensSummary([45, 40, 45]), { text: "40 · 45 cm", count: 2 });
  });
  it("collapses randomizer days into a min–max range with count", () => {
    const r = formatSensSummary([37.31, 41.14, 35.53, 39.18, 47.62, 33.84]);
    assert.deepEqual(r, { text: "33.8–47.6 cm", count: 6 });
  });
  it("ignores zero/invalid values", () => {
    assert.deepEqual(formatSensSummary([0, NaN]), { text: "", count: 0 });
  });
});
