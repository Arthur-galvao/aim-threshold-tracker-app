import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  latticeCm,
  latticeIndex,
  gridBounds,
  gridPoints,
  MIN_CM,
  MIN_GRID_POINTS,
} from "../src/lib/sens-lattice.ts";

interface FixtureItem {
  k: number;
  cm: number;
}

describe("sens-lattice module", () => {
  it("matches precomputed shared fixture points in sens-lattice.json", () => {
    const fixturePath = path.resolve(
      import.meta.dirname,
      "fixtures",
      "sens-lattice.json"
    );
    const content = fs.readFileSync(fixturePath, "utf-8");
    const items: FixtureItem[] = JSON.parse(content);

    for (const item of items) {
      const computedCm = latticeCm(item.k);
      assert(
        Math.abs(computedCm - item.cm) <= 0.02,
        `latticeCm(${item.k}) was ${computedCm}, expected ~${item.cm}`
      );

      const computedK = latticeIndex(item.cm);
      assert.equal(
        computedK,
        item.k,
        `latticeIndex(${item.cm}) was ${computedK}, expected ${item.k}`
      );
    }
  });

  it("maps legacy sensitivities to the closest lattice index", () => {
    // 33.37 cm -> closest index is -8 (33.84)
    assert.equal(latticeIndex(33.37), -8);
    // 52.0 cm -> closest is 1 (52.5)
    assert.equal(latticeIndex(52.0), 1);
  });

  it("gridBounds returns points within interval [30, 50]", () => {
    const [lo, hi] = gridBounds(30.0, 50.0);
    assert(lo <= hi);
    const points = gridPoints(30.0, 50.0);
    assert(points.length >= MIN_GRID_POINTS);
    assert(latticeCm(lo) >= 27.0 && latticeCm(lo) <= 32.0);
    assert(latticeCm(hi) <= 52.0);
  });

  it("gridBounds widens narrow ranges to at least MIN_GRID_POINTS points", () => {
    const [lo, hi] = gridBounds(40.0, 40.5);
    const count = hi - lo + 1;
    assert(count >= MIN_GRID_POINTS, `Expected >= 3 points, got ${count}`);
    const points = gridPoints(40.0, 40.5);
    assert.equal(points.length, count);
  });

  it("gridBounds respects MIN_CM floor of 5.0 cm", () => {
    const [lo] = gridBounds(2.0, 6.0);
    assert(latticeCm(lo) >= MIN_CM);
  });
});
