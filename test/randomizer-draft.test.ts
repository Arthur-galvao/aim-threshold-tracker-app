import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initDraft,
  syncDraftWithSettings,
  updateDraftField,
  validateDraft,
  isDraftDirty,
  draftToSettings,
  type RandomizerDraft,
} from "../src/lib/randomizer-draft.ts";
import type { RandomizerSettings } from "../src/hooks/useSensRandomizer.ts";

const BASE_SETTINGS: RandomizerSettings = {
  enabled: true,
  baseSensCm: 40.0,
  rangeMode: "cm360",
  minCm: 28.0,
  maxCm: 55.0,
  minMult: 0.75,
  maxMult: 1.35,
  avoidRepeats: true,
  rawaccelDir: "C:\\RawAccel",
  spreadPercent: 25.0,
  autoScenarioSens: true,
  mouseDpi: 800,
};

describe("randomizer-draft module", () => {
  test("initializes draft from settings without dirty state", () => {
    const draft = initDraft(BASE_SETTINGS);
    assert.equal(draft.baseSens, "40");
    assert.equal(draft.minCm, "28");
    assert.equal(draft.maxCm, "55");
    assert.equal(draft.rangeMode, "cm360");
    assert.equal(draft.mouseDpi, "800");
    assert.equal(draft.touched.size, 0);

    const errors = validateDraft(draft);
    assert.equal(errors.length, 0);
    assert.equal(isDraftDirty(draft, BASE_SETTINGS), false);
  });

  test("zero does not silently turn into default and fails validation", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "baseSens", "0");
    const errors = validateDraft(draft);
    assert.ok(errors.some((e) => e.field === "baseSens" && e.messageKey === "randomizer.errorBaseSensRange"));
  });

  test("validates baseSens boundaries (10 to 200)", () => {
    let draftLow = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "9.9");
    assert.ok(validateDraft(draftLow).some((e) => e.field === "baseSens"));

    let draftHigh = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "201");
    assert.ok(validateDraft(draftHigh).some((e) => e.field === "baseSens"));

    let draftValid = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "35.5");
    assert.equal(validateDraft(draftValid).length, 0);
  });

  test("validates mouseDpi range (100 to 32000)", () => {
    let draftLow = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "50");
    assert.ok(validateDraft(draftLow).some((e) => e.field === "mouseDpi"));

    let draftHigh = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "50000");
    assert.ok(validateDraft(draftHigh).some((e) => e.field === "mouseDpi"));

    let draftFloat = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "800.5");
    assert.ok(validateDraft(draftFloat).some((e) => e.field === "mouseDpi"));

    let draftValid = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "1600");
    assert.equal(validateDraft(draftValid).length, 0);
  });

  test("validates cm360 mode: minCm floor >= 5 and min < max", () => {
    let draftFloor = updateDraftField(initDraft(BASE_SETTINGS), "minCm", "4.9");
    assert.ok(validateDraft(draftFloor).some((e) => e.field === "minCm" && e.messageKey === "randomizer.errorMinCmFloor"));

    let draftOrder = updateDraftField(initDraft(BASE_SETTINGS), "minCm", "60");
    // maxCm is 55, minCm is 60 -> min >= max
    assert.ok(validateDraft(draftOrder).some((e) => e.field === "minCm" && e.messageKey === "randomizer.errorMinMaxOrder"));
  });

  test("validates multiplier mode: minMult > 0 and min < max", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "rangeMode", "multiplier");
    draft = updateDraftField(draft, "minMult", "0");
    assert.ok(validateDraft(draft).some((e) => e.field === "minMult" && e.messageKey === "randomizer.errorMinMultPositive"));

    draft = updateDraftField(draft, "minMult", "1.5");
    draft = updateDraftField(draft, "maxMult", "1.2");
    assert.ok(validateDraft(draft).some((e) => e.field === "minMult" && e.messageKey === "randomizer.errorMinMaxOrder"));
  });

  test("syncDraftWithSettings preserves touched fields and updates untouched fields", () => {
    let draft = initDraft(BASE_SETTINGS);
    // User is editing minCm
    draft = updateDraftField(draft, "minCm", "32.5");

    const externalUpdate: RandomizerSettings = {
      ...BASE_SETTINGS,
      baseSensCm: 45.0,
      minCm: 25.0,
      maxCm: 60.0,
    };

    const synced = syncDraftWithSettings(draft, externalUpdate);
    // minCm was touched -> preserved user's 32.5
    assert.equal(synced.minCm, "32.5");
    // baseSens was NOT touched -> updated to 45
    assert.equal(synced.baseSens, "45");
    // maxCm was NOT touched -> updated to 60
    assert.equal(synced.maxCm, "60");
  });

  test("draftToSettings produces clean RandomizerSettings", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "baseSens", "38.2");
    draft = updateDraftField(draft, "minCm", "25.0");
    draft = updateDraftField(draft, "maxCm", "50.0");
    draft = updateDraftField(draft, "mouseDpi", "1600");

    const result = draftToSettings(draft, BASE_SETTINGS);
    assert.equal(result.baseSensCm, 38.2);
    assert.equal(result.minCm, 25.0);
    assert.equal(result.maxCm, 50.0);
    assert.equal(result.mouseDpi, 1600);
  });
});
