import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectDpiMismatch } from "../src/lib/dpi-check.ts";

describe("detectDpiMismatch", () => {
  it("returns null when the app DPI is missing or invalid", () => {
    const sessions = [{ dpi: 800, date: "2026-01-01" }];
    assert.equal(detectDpiMismatch(sessions, undefined), null);
    assert.equal(detectDpiMismatch(sessions, 0), null);
    assert.equal(detectDpiMismatch(sessions, Number.NaN), null);
  });

  it("returns null when no session declares a DPI", () => {
    const sessions = [{ date: "2026-01-01" }, { dpi: 0, date: "2026-01-02" }];
    assert.equal(detectDpiMismatch(sessions, 800), null);
  });

  it("returns null within the 5% tolerance", () => {
    const sessions = [{ dpi: 820, date: "2026-01-01" }];
    assert.equal(detectDpiMismatch(sessions, 800), null);
  });

  it("flags a deviation above 5% using the median", () => {
    const sessions = [
      { dpi: 1600, date: "2026-01-05" },
      { dpi: 1600, date: "2026-01-04" },
      { dpi: 800, date: "2026-01-03" },
    ];
    const res = detectDpiMismatch(sessions, 800);
    assert.ok(res);
    assert.equal(res.csvDpi, 1600);
    assert.equal(res.appDpi, 800);
    assert.equal(res.deviation, 1);
  });

  it("a single outlier does not trigger the warning (median)", () => {
    const sessions = [
      { dpi: 1600, date: "2026-01-05" },
      { dpi: 800, date: "2026-01-04" },
      { dpi: 800, date: "2026-01-03" },
    ];
    assert.equal(detectDpiMismatch(sessions, 800), null);
  });

  it("uses the mean of the two middle values for an even count", () => {
    const sessions = [
      { dpi: 800, date: "2026-01-04" },
      { dpi: 1000, date: "2026-01-03" },
    ];
    const res = detectDpiMismatch(sessions, 800);
    assert.ok(res);
    assert.equal(res.csvDpi, 900);
    assert.ok(Math.abs(res.deviation - 0.125) < 1e-9);
  });

  it("only looks at the 10 most recent sessions, by datetime ?? date", () => {
    const old = Array.from({ length: 10 }, (_, i) => ({
      dpi: 1600,
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
    }));
    const recent = Array.from({ length: 10 }, (_, i) => ({
      dpi: 800,
      datetime: `2026-02-${String(i + 1).padStart(2, "0")}T10:00:00`,
    }));
    assert.equal(detectDpiMismatch([...old, ...recent], 800), null);
  });

  it("ignores sessions without dpi when computing the median", () => {
    const sessions = [
      { date: "2026-01-03" },
      { dpi: 1600, date: "2026-01-02" },
      { dpi: 1600, date: "2026-01-01" },
    ];
    const res = detectDpiMismatch(sessions, 800);
    assert.ok(res);
    assert.equal(res.csvDpi, 1600);
  });
});
