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

import { formatScore, pickXLabels } from "../src/lib/chart-format.ts";

describe("pickXLabels", () => {
  it("drops repeated dates and labels closer than minGap", () => {
    const items = [
      { x: 10, label: "29/10" },
      { x: 20, label: "29/10" },
      { x: 40, label: "30/10" },
      { x: 120, label: "31/10" },
      { x: 150, label: "01/11" },
    ];
    assert.deepEqual(
      pickXLabels(items, 90).map((i) => i.label),
      ["29/10", "31/10"]
    );
  });
  it("keeps everything when there is room", () => {
    const items = [
      { x: 0, label: "a" },
      { x: 100, label: "b" },
    ];
    assert.equal(pickXLabels(items, 90).length, 2);
  });
});

describe("formatScore", () => {
  it("uses the locale thousands separator and rounds big scores", () => {
    assert.equal(formatScore(1110.4, "pt"), "1.110");
    assert.equal(formatScore(1110.4, "en"), "1,110");
    assert.equal(formatScore(48.26, "pt"), "48,3");
    assert.equal(formatScore(NaN, "pt"), "—");
  });
});
